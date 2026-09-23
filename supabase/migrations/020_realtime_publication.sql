-- =====================================================
-- Migration 020: Make sure realtime is enabled for tables the app subscribes to
-- No earlier migration added tables to the supabase_realtime publication, so
-- postgres_changes subscriptions on `comments` never fired (new comments only
-- appeared after leaving and re-opening a post). Idempotent — safe to re-run.
-- =====================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['comments', 'messages', 'swaps'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Verification:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
