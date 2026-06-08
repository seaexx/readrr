-- Ratings table: user ratings after a completed swap
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swap_id UUID NOT NULL REFERENCES public.swaps(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rated_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 300),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_rating CHECK (rater_id != rated_id),
  CONSTRAINT one_rating_per_swap_per_rater UNIQUE (swap_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_rated_id ON public.ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON public.ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_swap_id ON public.ratings(swap_id);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select" ON public.ratings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ratings_insert" ON public.ratings
  FOR INSERT WITH CHECK (auth.uid() = rater_id);

-- After a rating is inserted, recalculate avg_rating on users table
CREATE OR REPLACE FUNCTION update_user_avg_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET avg_rating = (
    SELECT COALESCE(AVG(score), 0)
    FROM public.ratings
    WHERE rated_id = NEW.rated_id
  )
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_avg_rating
  AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION update_user_avg_rating();
