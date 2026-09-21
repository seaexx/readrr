-- =====================================================
-- Migration 017: Personal bookshelf
-- Readers save books to Want to Read / Reading / Finished,
-- independent of swap listings ("Available to Swap" stays
-- represented by swap posts). Powers wishlist matching.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.shelf_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  isbn TEXT,
  title TEXT NOT NULL,
  author TEXT,
  cover_image_url TEXT,
  shelf TEXT NOT NULL CHECK (shelf IN ('want_to_read', 'reading', 'finished')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shelf_user ON public.shelf_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shelf_user_shelf ON public.shelf_items(user_id, shelf);

-- One entry per ISBN per user (manual entries without ISBN may repeat;
-- the app upserts by ISBN when present, else by title+author)
CREATE UNIQUE INDEX IF NOT EXISTS ux_shelf_user_isbn
  ON public.shelf_items(user_id, isbn) WHERE isbn IS NOT NULL;

DROP TRIGGER IF EXISTS update_shelf_items_updated_at ON public.shelf_items;
CREATE TRIGGER update_shelf_items_updated_at
  BEFORE UPDATE ON public.shelf_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.shelf_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own shelf" ON public.shelf_items;
CREATE POLICY "Users manage own shelf"
ON public.shelf_items
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Verification
-- =====================================================
-- SELECT tablename, policyname FROM pg_policies WHERE tablename = 'shelf_items';
