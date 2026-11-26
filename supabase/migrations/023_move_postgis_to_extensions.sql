-- =====================================================
-- 023: Move PostGIS from `public` to `extensions`
-- =====================================================
-- Fixes the Supabase linter error "RLS Disabled in Public" on
-- public.spatial_ref_sys. That table belongs to PostGIS and is owned by
-- supabase_admin, so we can't enable RLS on it or revoke the API's write access
-- (see 022). Installing PostGIS in the `extensions` schema, which PostgREST
-- doesn't expose, takes spatial_ref_sys out of the API entirely.
--
-- PostGIS isn't relocatable, so this uninstalls and reinstalls it. Uninstalling
-- drops everything built on its types. In this project that is exactly:
--   users.location, posts.location  (geography(Point,4326), nullable, no default)
--   idx_users_location, idx_posts_location  (GiST)
-- Our SQL functions don't hold hard dependencies on PostGIS; they resolve ST_*
-- by search_path at call time, so they survive and are re-pointed below.
--
-- Safety:
--   * Locations are copied to a temp table first and restored afterwards.
--   * A separate copy was taken before this ran: backup.locations_20261126
--     (schema not exposed to the API). Drop it once the app is verified.
--   * Supabase CLI runs each migration in one transaction; the final checks
--     RAISE on any mismatch, which rolls the whole migration back.
-- =====================================================

-- 1. Copy current locations (as WKT text, which survives the uninstall)
CREATE TEMP TABLE _loc ON COMMIT DROP AS
  SELECT 'users'::text AS tbl, id, ST_AsText(location::geometry) AS wkt
    FROM public.users WHERE location IS NOT NULL
  UNION ALL
  SELECT 'posts', id, ST_AsText(location::geometry)
    FROM public.posts WHERE location IS NOT NULL;

-- 2. Reinstall PostGIS in `extensions`
DROP EXTENSION postgis CASCADE;
CREATE EXTENSION postgis WITH SCHEMA extensions;

-- 3. Recreate the columns and indexes exactly as before
ALTER TABLE public.users ADD COLUMN location extensions.geography(Point, 4326);
ALTER TABLE public.posts ADD COLUMN location extensions.geography(Point, 4326);

CREATE INDEX idx_users_location ON public.users USING gist (location);
CREATE INDEX idx_posts_location ON public.posts USING gist (location) WHERE (post_type = 'swap');

-- 4. Restore the data
UPDATE public.users u
   SET location = extensions.ST_GeogFromText('SRID=4326;' || l.wkt)
  FROM _loc l
 WHERE l.tbl = 'users' AND l.id = u.id;

UPDATE public.posts p
   SET location = extensions.ST_GeogFromText('SRID=4326;' || l.wkt)
  FROM _loc l
 WHERE l.tbl = 'posts' AND l.id = p.id;

-- 5. Functions that call PostGIS: make `extensions` resolvable regardless of
--    the caller's search_path (two of them pinned search_path to public only).
ALTER FUNCTION public.calculate_distance_miles(double precision, double precision, double precision, double precision)
  SET search_path = public, extensions;
ALTER FUNCTION public.get_nearby_users(double precision, double precision, double precision)
  SET search_path = public, extensions;
ALTER FUNCTION public.get_nearby_posts(double precision, double precision, double precision, integer, integer)
  SET search_path = public, extensions;
ALTER FUNCTION public.get_nearby_swap_posts(double precision, double precision, double precision, integer, integer, uuid[])
  SET search_path = public, extensions;
ALTER FUNCTION public.get_wishlist_match_recipients(uuid, double precision)
  SET search_path = public, extensions;

-- 6. Verify, or roll everything back
DO $$
DECLARE
  restored_users INT;
  restored_posts INT;
  expected_users INT;
  expected_posts INT;
  mismatched INT;
BEGIN
  SELECT COUNT(*) FILTER (WHERE tbl = 'users'), COUNT(*) FILTER (WHERE tbl = 'posts')
    INTO expected_users, expected_posts FROM _loc;
  SELECT COUNT(*) INTO restored_users FROM public.users WHERE location IS NOT NULL;
  SELECT COUNT(*) INTO restored_posts FROM public.posts WHERE location IS NOT NULL;

  IF restored_users <> expected_users OR restored_posts <> expected_posts THEN
    RAISE EXCEPTION '023: location restore mismatch (users %/%, posts %/%)',
      restored_users, expected_users, restored_posts, expected_posts;
  END IF;

  -- Every restored point must match its saved coordinates exactly
  SELECT COUNT(*) INTO mismatched FROM _loc l
   WHERE l.wkt IS DISTINCT FROM (
     CASE l.tbl
       WHEN 'users' THEN (SELECT extensions.ST_AsText(location::extensions.geometry) FROM public.users WHERE id = l.id)
       ELSE (SELECT extensions.ST_AsText(location::extensions.geometry) FROM public.posts WHERE id = l.id)
     END);
  IF mismatched > 0 THEN
    RAISE EXCEPTION '023: % restored locations differ from the saved copy', mismatched;
  END IF;

  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    RAISE EXCEPTION '023: public.spatial_ref_sys still exists';
  END IF;

  -- The nearby-swaps query must still run (it exercises ST_DWithin + geography casts)
  PERFORM * FROM public.get_nearby_swap_posts(51.5, -0.12, 25, 1, 0, '{}'::uuid[]);

  RAISE NOTICE '023: PostGIS moved to extensions; restored % user and % post locations',
    restored_users, restored_posts;
END $$;
