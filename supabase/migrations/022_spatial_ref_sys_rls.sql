-- =====================================================
-- 022: Lock down public.spatial_ref_sys (Supabase linter: "RLS Disabled in Public")
-- =====================================================
-- spatial_ref_sys is PostGIS's table of coordinate-system definitions. It holds
-- no user data, but sitting in `public` it is exposed through the API, and the
-- default grants let anon/authenticated write to it, so anyone could tamper
-- with the SRID definitions our distance queries rely on.
--
-- Supabase's suggested fix of moving PostGIS to another schema means dropping
-- and recreating the extension, which would drop users.location and
-- posts.location. Instead: enable RLS with a read-only policy (PostGIS still
-- reads it), and revoke writes from the API roles.
--
-- On some projects the table is owned by supabase_admin, so ALTER TABLE fails
-- for the migration role. Each step is guarded and reports what it did.
--
-- RESULT ON THE LIVE PROJECT (applied 2026-11-26): no-op. spatial_ref_sys is
-- owned by supabase_admin and `postgres` holds no grant option, so neither the
-- RLS change nor the REVOKE took effect (anon/authenticated still have write
-- privileges). Fixing it needs Supabase support or relocating PostGIS; see todo.md.
-- =====================================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "spatial_ref_sys is readable" ON public.spatial_ref_sys;
    CREATE POLICY "spatial_ref_sys is readable"
      ON public.spatial_ref_sys FOR SELECT
      USING (true);
    RAISE NOTICE '022: RLS enabled on spatial_ref_sys with a read-only policy';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '022: not owner of spatial_ref_sys, RLS not enabled (falling back to revoking writes)';
  END;

  BEGIN
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spatial_ref_sys FROM anon, authenticated;
    RAISE NOTICE '022: revoked writes on spatial_ref_sys from anon/authenticated';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE '022: could not revoke writes on spatial_ref_sys (insufficient privilege)';
  END;
END $$;
