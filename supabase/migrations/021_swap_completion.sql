-- =====================================================
-- 021: Swap request history + atomic swap completion
-- =====================================================
-- 1. UNIQUE (post_id, requester_id, status) blocked a second cancel or decline
--    of the same post by the same requester, because a row with that status
--    already existed. Only *active* requests need to be unique, so it becomes a
--    partial unique index over pending/accepted.
-- 2. Completing a swap took three client requests: set my flag, read both
--    flags, then mark the swap completed and the post swapped. Two people
--    confirming at once each saw the other's flag still false, so the swap
--    never completed. And when the requester confirmed last, posts RLS
--    silently blocked marking the post swapped, leaving it in the feed.
--    confirm_swap_complete() does all of it in one transaction, with the swap
--    row locked so concurrent confirms run one after the other.
-- =====================================================

-- Fail with a clear message instead of a bare index error if existing data
-- already has two active requests for the same post from the same person.
DO $$
DECLARE
  dupes INT;
BEGIN
  SELECT COUNT(*) INTO dupes FROM (
    SELECT post_id, requester_id
    FROM public.swaps
    WHERE status IN ('pending', 'accepted')
    GROUP BY post_id, requester_id
    HAVING COUNT(*) > 1
  ) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION '% (post_id, requester_id) pairs have more than one pending/accepted swap. Resolve them before running 021.', dupes;
  END IF;
END $$;

ALTER TABLE public.swaps DROP CONSTRAINT IF EXISTS one_active_request_per_post;

CREATE UNIQUE INDEX IF NOT EXISTS ux_swaps_active_request
  ON public.swaps (post_id, requester_id)
  WHERE status IN ('pending', 'accepted');

-- Keep the eligibility check in line with the index: an accepted request also
-- blocks a new one.
CREATE OR REPLACE FUNCTION can_request_swap(user_uuid UUID, post_uuid UUID)
RETURNS BOOLEAN AS $$
  DECLARE
    post_owner UUID;
    existing_request UUID;
  BEGIN
    SELECT user_id INTO post_owner FROM public.posts WHERE id = post_uuid;

    IF post_owner = user_uuid THEN
      RETURN FALSE; -- Can't swap own book
    END IF;

    SELECT id INTO existing_request
    FROM public.swaps
    WHERE post_id = post_uuid
      AND requester_id = user_uuid
      AND status IN ('pending', 'accepted');

    IF existing_request IS NOT NULL THEN
      RETURN FALSE; -- Already has an active request
    END IF;

    RETURN TRUE;
  END;
$$ LANGUAGE plpgsql;

-- Confirm the caller's side of a swap. Returns TRUE once both sides have
-- confirmed (the swap is then completed and its post marked swapped).
-- SECURITY DEFINER so the post update isn't blocked by posts RLS when the
-- requester confirms last; the caller is checked against the swap instead.
CREATE OR REPLACE FUNCTION public.confirm_swap_complete(swap_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.swaps%ROWTYPE;
  caller UUID := auth.uid();
  both_confirmed BOOLEAN;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO s FROM public.swaps WHERE id = swap_uuid FOR UPDATE;

  IF NOT FOUND OR caller NOT IN (s.requester_id, s.owner_id) THEN
    RAISE EXCEPTION 'Swap not found';
  END IF;

  IF s.status = 'completed' THEN
    RETURN TRUE;
  END IF;

  IF s.status <> 'accepted' THEN
    RAISE EXCEPTION 'Swap is not in progress';
  END IF;

  both_confirmed :=
    (s.owner_confirmed_complete OR caller = s.owner_id) AND
    (s.requester_confirmed_complete OR caller = s.requester_id);

  UPDATE public.swaps
  SET owner_confirmed_complete = owner_confirmed_complete OR caller = s.owner_id,
      requester_confirmed_complete = requester_confirmed_complete OR caller = s.requester_id,
      status = CASE WHEN both_confirmed THEN 'completed' ELSE status END,
      completed_at = CASE WHEN both_confirmed THEN NOW() ELSE completed_at END
  WHERE id = swap_uuid;

  -- total_swaps is incremented by the trigger from 010 on the status change.
  IF both_confirmed THEN
    UPDATE public.posts SET availability = 'swapped' WHERE id = s.post_id;
  END IF;

  RETURN both_confirmed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_swap_complete(UUID) TO authenticated;
