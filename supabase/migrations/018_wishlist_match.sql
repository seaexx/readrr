-- =====================================================
-- Migration 018: Wishlist match alerts
-- When a swap post is created, find OTHER users who have that book on their
-- want-to-read shelf AND are within range, so we can notify them
-- ("a book on your wishlist just appeared nearby").
--
-- Reuses:
--   - shelf_items (017) for the wishlist
--   - users.location + posts.location (PostGIS geography) for proximity
--   - get_blocked_user_ids() (012) to respect mutual blocks
--
-- SECURITY DEFINER so the poster's client can find matching users without
-- read access to other people's shelves. Returns only user ids + distance;
-- the client sends the push via the existing sendPushNotification path
-- (which already reads the target's push token), so no tokens are exposed here.
-- =====================================================

DROP FUNCTION IF EXISTS public.get_wishlist_match_recipients(UUID, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.get_wishlist_match_recipients(
  new_post_id UUID,
  radius_miles DOUBLE PRECISION DEFAULT 25
)
RETURNS TABLE (
  user_id UUID,
  distance_miles DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_user_id  UUID;
  p_title    TEXT;
  p_location GEOGRAPHY;
  p_type     TEXT;
  norm_title TEXT;
BEGIN
  SELECT posts.user_id, posts.title, posts.location, posts.post_type
    INTO p_user_id, p_title, p_location, p_type
  FROM public.posts
  WHERE posts.id = new_post_id;

  -- Only swap posts with a location can match; bail otherwise.
  IF NOT FOUND OR p_type <> 'swap' OR p_location IS NULL THEN
    RETURN;
  END IF;

  -- Same normalization the app uses (shelfService.normalizeTitle):
  -- lowercase, trim, collapse internal whitespace.
  norm_title := lower(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')));
  IF norm_title = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    ST_Distance(u.location, p_location) / 1609.34 AS distance_miles
  FROM public.users u
  WHERE u.id <> p_user_id
    AND u.location IS NOT NULL
    AND ST_DWithin(u.location, p_location, radius_miles * 1609.34)
    AND u.id NOT IN (SELECT get_blocked_user_ids(p_user_id))
    AND EXISTS (
      SELECT 1
      FROM public.shelf_items si
      WHERE si.user_id = u.id
        AND si.shelf = 'want_to_read'
        AND lower(btrim(regexp_replace(coalesce(si.title, ''), '\s+', ' ', 'g'))) = norm_title
    )
  ORDER BY distance_miles ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wishlist_match_recipients(UUID, DOUBLE PRECISION) TO authenticated;

-- =====================================================
-- Verification
-- =====================================================
-- SELECT * FROM get_wishlist_match_recipients('<a-swap-post-uuid>');
-- Expect rows for users within 25 mi whose want_to_read shelf holds that title.
