-- Follows table: tracks user follow relationships
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view follows
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can only create their own follow relationships
CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can only delete their own follow relationships
CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Helper functions for counts
CREATE OR REPLACE FUNCTION get_follower_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.follows WHERE following_id = user_uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_following_count(user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.follows WHERE follower_id = user_uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
