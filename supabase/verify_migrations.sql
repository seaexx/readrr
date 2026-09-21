-- =====================================================
-- Readrr — migration state verification (READ-ONLY, safe to run anytime)
-- =====================================================
-- Because migrations were applied by hand, the live database may be
-- missing some of them — which silently breaks features (push, blocks,
-- nearby feed, account deletion, the whole shelf). This script does NOT
-- change anything; it reports which migrations are present.
--
-- How to use:
--   1. Paste this whole file into the Supabase SQL editor and run it.
--   2. Every row should read PASS. For any FAIL, open the named file under
--      supabase/migrations/ and run it, then re-run this script until all PASS.
--   3. Order matters: run missing migrations by ascending number.
--
-- The checks look for each migration's signature object(s).
-- =====================================================

WITH checks AS (

  -- 011: in-app notifications table (notificationsService writes here)
  SELECT '011_notifications_table' AS migration, 'notifications table' AS object,
         to_regclass('public.notifications') IS NOT NULL AS ok
  UNION ALL

  -- 012: block + report foundation (prerequisite for 014)
  SELECT '012_blocks_reports', 'blocks table',
         to_regclass('public.blocks') IS NOT NULL
  UNION ALL
  SELECT '012_blocks_reports', 'reports table',
         to_regclass('public.reports') IS NOT NULL
  UNION ALL
  SELECT '012_blocks_reports', 'get_blocked_user_ids() function',
         EXISTS (SELECT 1 FROM pg_proc
                 WHERE proname = 'get_blocked_user_ids'
                   AND pronamespace = 'public'::regnamespace)
  UNION ALL

  -- 013: push token column + username/caption constraints
  SELECT '013_p0_hardening', 'users.fcm_token column',
         EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'users'
                   AND column_name = 'fcm_token')
  UNION ALL
  SELECT '013_p0_hardening', 'users_username_format constraint',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format')
  UNION ALL
  SELECT '013_p0_hardening', 'posts_caption_max_len constraint',
         EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_caption_max_len')
  UNION ALL

  -- 014: block enforcement lives in the swaps/messages INSERT policies
  -- (a plain policy from 006 is not enough — it must reference the block helper)
  SELECT '014_block_enforcement', 'swaps insert policy enforces blocks',
         EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'swaps'
                   AND with_check LIKE '%get_blocked_user_ids%')
  UNION ALL
  SELECT '014_block_enforcement', 'messages insert policy enforces blocks',
         EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname = 'public' AND tablename = 'messages'
                   AND with_check LIKE '%get_blocked_user_ids%')
  UNION ALL

  -- 015: nearby feed RPC
  SELECT '015_nearby_feed', 'get_nearby_swap_posts() function',
         EXISTS (SELECT 1 FROM pg_proc
                 WHERE proname = 'get_nearby_swap_posts'
                   AND pronamespace = 'public'::regnamespace)
  UNION ALL

  -- 016: self-service account deletion RPC
  SELECT '016_account_deletion', 'delete_own_account() function',
         EXISTS (SELECT 1 FROM pg_proc
                 WHERE proname = 'delete_own_account'
                   AND pronamespace = 'public'::regnamespace)
  UNION ALL

  -- 017: personal bookshelf (want_to_read / reading / finished)
  SELECT '017_shelf', 'shelf_items table',
         to_regclass('public.shelf_items') IS NOT NULL
  UNION ALL
  SELECT '017_shelf', 'shelf_items RLS enabled',
         EXISTS (SELECT 1 FROM pg_class
                 WHERE relname = 'shelf_items' AND relnamespace = 'public'::regnamespace
                   AND relrowsecurity = true)
)
SELECT
  migration,
  object,
  CASE WHEN ok
       THEN 'PASS'
       ELSE 'FAIL  ->  run supabase/migrations/' || migration || '.sql'
  END AS status
FROM checks
ORDER BY migration, object;
