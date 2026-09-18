-- =====================================================
-- Migration 014: Server-side block enforcement
-- Blocks previously only affected the app UI. These policies
-- make them binding at the database level using the existing
-- mutual-blocks helper get_blocked_user_ids(user_uuid)
-- (defined in migration 012):
--   1. Cannot create a swap request targeting someone who
--      has blocked you / whom you have blocked
--   2. Cannot send chat messages in a swap involving a block
-- =====================================================

-- 1. Swap requests: block between requester and owner
DROP POLICY IF EXISTS "Authenticated users can create swap requests"
  ON public.swaps;

CREATE POLICY "Authenticated users can create swap requests"
ON public.swaps FOR INSERT
WITH CHECK (
  auth.uid() = requester_id AND
  status = 'pending' AND
  owner_id NOT IN (SELECT get_blocked_user_ids(auth.uid()))
);

-- 2. Messages: block either direction inside an accepted swap
DROP POLICY IF EXISTS "Users can send messages in their swaps"
  ON public.messages;

CREATE POLICY "Users can send messages in their swaps"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.swaps
    WHERE swaps.id = messages.swap_id
      AND (swaps.requester_id = auth.uid() OR swaps.owner_id = auth.uid())
      AND swaps.status = 'accepted'
      AND requester_id NOT IN (SELECT get_blocked_user_ids(auth.uid()))
      AND owner_id NOT IN (SELECT get_blocked_user_ids(auth.uid()))
  )
);

-- =====================================================
-- Verification
-- =====================================================
-- SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('swaps', 'messages')
--   ORDER BY tablename, policyname;
--
-- As user A (who blocked user B), inserting a swap request on
-- B's post should now fail with RLS violation error 42501.
