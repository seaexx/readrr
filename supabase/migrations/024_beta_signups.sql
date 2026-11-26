-- =====================================================
-- 024: Beta sign-ups from readrr.app
-- =====================================================
-- The landing page posts to the `beta-signup` Edge Function, which inserts
-- here with the service role. The table is not reachable through the API at
-- all: RLS on with no policies, and no grants to anon/authenticated. So the
-- page carries no Supabase key, and nobody can read the list from outside.
--
-- Read sign-ups in the dashboard (Table Editor → beta_signups) or with:
--   supabase db query --linked "select * from beta_signups order by created_at desc"
-- =====================================================

CREATE TABLE IF NOT EXISTS public.beta_signups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254 AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  city        TEXT CHECK (city IS NULL OR char_length(city) <= 100),
  phone       TEXT NOT NULL DEFAULT 'iPhone' CHECK (phone IN ('iPhone', 'Android')),
  postage     TEXT CHECK (postage IS NULL OR postage IN ('yes', 'no', 'not in the UK')),
  source      TEXT CHECK (source IS NULL OR char_length(source) <= 60),
  invited_at  TIMESTAMPTZ,            -- set when you send the TestFlight invite
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per address, case-insensitively; repeat sign-ups are ignored.
CREATE UNIQUE INDEX IF NOT EXISTS ux_beta_signups_email ON public.beta_signups (lower(email));

ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_signups FROM anon, authenticated;
