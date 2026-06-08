-- Add meetup location coordination columns to swaps table
-- State machine: none → proposed → agreed (or reset back to none)
ALTER TABLE public.swaps
  ADD COLUMN IF NOT EXISTS meetup_status TEXT
    CHECK (meetup_status IN ('none', 'proposed', 'agreed'))
    DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS meetup_proposed_by UUID
    REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meetup_venue_name TEXT
    CHECK (char_length(meetup_venue_name) <= 200),
  ADD COLUMN IF NOT EXISTS meetup_venue_address TEXT
    CHECK (char_length(meetup_venue_address) <= 400),
  ADD COLUMN IF NOT EXISTS meetup_venue_category TEXT
    CHECK (meetup_venue_category IN (
      'coffee_shop', 'library', 'bookshop', 'bar',
      'book_club', 'community_space', 'other'
    )),
  ADD COLUMN IF NOT EXISTS meetup_proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meetup_agreed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_swaps_meetup_status
  ON public.swaps(meetup_status)
  WHERE meetup_status != 'none';
