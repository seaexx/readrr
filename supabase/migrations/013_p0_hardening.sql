-- =====================================================
-- Migration 013: P0 hardening
-- Fixes three gaps between code and database schema:
--   1. users.fcm_token was missing from migration 001
--      (it IS in the intended blueprint schema; push
--      registration in notificationsService.ts writes it)
--   2. Username format was only validated client-side;
--      blueprint specifies a DB CHECK constraint
--   3. posts.caption DB limit was 120 while the UI allows
--      and counters 500 — align the DB to 500
-- =====================================================

-- 1. fcm_token for Expo push registration
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 2. Username format enforcement (matches client-side
--    validation in src/utils/validation.ts)
--    NOT VALID so existing rows that predate this rule
--    don't break the migration; all NEW inserts/updates
--    are enforced. Clean up legacy rows at your leisure:
--      SELECT id, username FROM public.users
--      WHERE username !~ '^[a-z0-9_]{3,20}$';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_format'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_username_format
      CHECK (username ~ '^[a-z0-9_]{3,20}$')
      NOT VALID;
  END IF;
END $$;

-- 3. Caption limit: drop the unnamed check created by
--    migration 001 (auto-named posts_caption_check) and
--    re-add at 500 chars to match SocialPostScreen's UI
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey)
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE c.contype = 'c'
    AND t.relname = 'posts'
    AND a.attname = 'caption'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_caption_max_len
  CHECK (caption IS NULL OR char_length(caption) <= 500);

-- =====================================================
-- Verification
-- =====================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'users' AND column_name = 'fcm_token';
--
-- SELECT conname, convalidated FROM pg_constraint
--   WHERE conname IN ('users_username_format', 'posts_caption_max_len');
