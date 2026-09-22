-- =====================================================
-- Migration 019: Duplicate-listing prevention
-- A user could list the same book for swap multiple times. This adds a
-- partial unique index so a user can have at most ONE *available* swap
-- listing per book (matched on normalized title, mirroring the app's
-- shelfService.normalizeTitle: lowercase, trimmed, collapsed whitespace).
--
-- Social posts are unaffected (re-reading / multiple updates are fine), and
-- once a listing is marked swapped/pending the user can list the book again.
-- =====================================================

-- 1. De-dupe existing data first so the unique index can be created.
--    Keep the most recent available listing per user+title; hide the rest
--    (non-destructive — the rows and any swaps/chat stay intact).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))
      ORDER BY created_at DESC
    ) AS rn
  FROM public.posts
  WHERE post_type = 'swap' AND availability = 'available'
)
UPDATE public.posts
SET availability = 'swapped'
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Enforce it going forward.
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_swap_per_user_title
  ON public.posts (user_id, lower(btrim(regexp_replace(title, '\s+', ' ', 'g'))))
  WHERE post_type = 'swap' AND availability = 'available';

-- =====================================================
-- Verification
-- =====================================================
-- A second available swap post for the same title by the same user now fails
-- with unique_violation (SQLSTATE 23505), which the app catches to show a
-- friendly "already listed" message.
