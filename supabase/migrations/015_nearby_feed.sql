-- =====================================================
-- Migration 015: Nearby feed — radius query helper
-- Enables the Swaps tab to show only posts within 25 miles,
-- sorted nearest-first, with distance for the UI badge.
-- Uses the existing PostGIS geography columns on posts.location
-- (created in 005_post_expansion.sql). Posts without a location
-- are excluded from nearby results — they remain visible only
-- when the viewer has no location (fallback to unfiltered feed).
-- =====================================================

-- Drop any earlier draft of this function if it exists
DROP FUNCTION IF EXISTS public.get_nearby_swap_posts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, INT, UUID[]);

CREATE OR REPLACE FUNCTION public.get_nearby_swap_posts(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION DEFAULT 25,
  result_limit INT DEFAULT 20,
  result_offset INT DEFAULT 0,
  blocked_ids UUID[] DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  author TEXT,
  isbn TEXT,
  cover_image_url TEXT,
  image_url TEXT,
  cover_url TEXT,
  post_type TEXT,
  condition TEXT,
  genre TEXT,
  swap_type TEXT,
  availability TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_miles DOUBLE PRECISION,
  username TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  origin GEOGRAPHY;
BEGIN
  origin := ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    p.id,
    p.user_id,
    p.title,
    p.author,
    p.isbn,
    p.cover_image_url,
    p.image_url,
    p.cover_url,
    p.post_type,
    p.condition,
    p.genre,
    p.swap_type,
    p.availability,
    p.created_at,
    p.updated_at,
    ST_Distance(p.location::geography, origin) / 1609.34 AS distance_miles,
    u.username,
    u.avatar_url
  FROM public.posts p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.post_type = 'swap'
    AND p.availability = 'available'
    AND p.location IS NOT NULL
    AND ST_DWithin(p.location::geography, origin, radius_miles * 1609.34)
    AND (blocked_ids IS NULL OR array_length(blocked_ids, 1) IS NULL OR NOT (p.user_id = ANY(blocked_ids)))
  ORDER BY distance_miles ASC, p.created_at DESC
  LIMIT result_limit OFFSET result_offset;
END;
$$;

-- Allow authenticated users to call it (anon would have no location anyway)
GRANT EXECUTE ON FUNCTION public.get_nearby_swap_posts(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, INT, UUID[]) TO authenticated;

-- =====================================================
-- Verification
-- =====================================================
-- -- Chesterfield centre: 53.2350, -1.4219 — 25-mile radius
-- SELECT id, title, distance_miles, username
-- FROM get_nearby_swap_posts(53.2350, -1.4219, 25, 20, 0, '{}');
--
-- -- With blocks:
-- SELECT * FROM get_nearby_swap_posts(53.2350, -1.4219, 25, 20, 0, ARRAY['00000000-0000-0000-0000-000000000000']::uuid[]);
