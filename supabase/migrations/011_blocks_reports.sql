-- Blocks table: tracks user block relationships (mutual effect)
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_select" ON public.blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

CREATE POLICY "blocks_insert" ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete" ON public.blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Reports table: user/post reports for moderation
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reported_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  reason VARCHAR NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Helper: get all user IDs that a user has blocked or been blocked by (mutual)
CREATE OR REPLACE FUNCTION get_blocked_user_ids(user_uuid UUID)
RETURNS SETOF UUID AS $$
  SELECT blocked_id FROM public.blocks WHERE blocker_id = user_uuid
  UNION
  SELECT blocker_id FROM public.blocks WHERE blocked_id = user_uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
