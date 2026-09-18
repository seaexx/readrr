--- 1. Create swaps table**

-- ============================================
-- SWAPS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.swaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who's involved
  requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  
  -- Status lifecycle
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  
  -- Optional message with request
  request_message TEXT CHECK (length(request_message) <= 500),
  
  -- Completion tracking (both must confirm)
  requester_confirmed_complete BOOLEAN DEFAULT FALSE,
  owner_confirmed_complete BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT different_users CHECK (requester_id != owner_id),
  CONSTRAINT one_active_request_per_post UNIQUE (post_id, requester_id, status)
);

-- Indexes for performance
CREATE INDEX idx_swaps_requester ON public.swaps(requester_id);
CREATE INDEX idx_swaps_owner ON public.swaps(owner_id);
CREATE INDEX idx_swaps_post ON public.swaps(post_id);
CREATE INDEX idx_swaps_status ON public.swaps(status);
CREATE INDEX idx_swaps_created_at ON public.swaps(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_swaps_updated_at
  BEFORE UPDATE ON public.swaps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.swaps IS 'Swap requests and their lifecycle from request to completion';
COMMENT ON COLUMN public.swaps.status IS 'pending = requested, accepted = both can chat, declined = owner said no, completed = both confirmed swap happened, cancelled = requester cancelled';
COMMENT ON COLUMN public.swaps.requester_confirmed_complete IS 'True when requester marks swap complete';
COMMENT ON COLUMN public.swaps.owner_confirmed_complete IS 'True when owner marks swap complete';

--- 2. Create messages table**


-- ============================================
-- MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Which swap this message belongs to
  swap_id UUID REFERENCES public.swaps(id) ON DELETE CASCADE NOT NULL,
  
  -- Who sent it
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Message content
  content TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 1000),
  
  -- Read status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_swap ON public.messages(swap_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_unread ON public.messages(is_read) WHERE is_read = FALSE;

-- Updated at trigger
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.messages IS 'Chat messages between swap partners';
COMMENT ON COLUMN public.messages.content IS 'Message text, max 1000 characters';

---

---- 3. Row Level Security (RLS)

-- ============================================
-- SWAPS RLS POLICIES
-- ============================================

ALTER TABLE public.swaps ENABLE ROW LEVEL SECURITY;

-- Users can view swaps they're involved in
CREATE POLICY "Users can view their own swaps"
ON public.swaps FOR SELECT
USING (
  auth.uid() = requester_id OR auth.uid() = owner_id
);

-- Authenticated users can create swap requests
CREATE POLICY "Authenticated users can create swap requests"
ON public.swaps FOR INSERT
WITH CHECK (
  auth.uid() = requester_id AND
  status = 'pending'
);

-- Users can update swaps they're involved in
CREATE POLICY "Users can update their own swaps"
ON public.swaps FOR UPDATE
USING (
  auth.uid() = requester_id OR auth.uid() = owner_id
);

-- Users can delete (cancel) swaps they requested
CREATE POLICY "Requesters can delete their swap requests"
ON public.swaps FOR DELETE
USING (auth.uid() = requester_id);

-- ============================================
-- MESSAGES RLS POLICIES
-- ============================================

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in swaps they're part of
CREATE POLICY "Users can view messages in their swaps"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.swaps
    WHERE swaps.id = messages.swap_id
      AND (swaps.requester_id = auth.uid() OR swaps.owner_id = auth.uid())
  )
);

-- Users can send messages in accepted swaps
CREATE POLICY "Users can send messages in their swaps"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.swaps
    WHERE swaps.id = messages.swap_id
      AND (swaps.requester_id = auth.uid() OR swaps.owner_id = auth.uid())
      AND swaps.status = 'accepted'
  )
);

-- Users can update their own messages (for read status)
CREATE POLICY "Users can update message read status"
ON public.messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.swaps
    WHERE swaps.id = messages.swap_id
      AND (swaps.requester_id = auth.uid() OR swaps.owner_id = auth.uid())
  )
);

--- 4. Helper Functions**

-- Function to get unread message count for a swap
CREATE OR REPLACE FUNCTION get_unread_count(swap_uuid UUID, user_uuid UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.messages
  WHERE swap_id = swap_uuid
    AND sender_id != user_uuid
    AND is_read = FALSE;
$$ LANGUAGE SQL STABLE;

-- Function to mark all messages as read in a swap
CREATE OR REPLACE FUNCTION mark_messages_read(swap_uuid UUID, user_uuid UUID)
RETURNS VOID AS $$
  UPDATE public.messages
  SET is_read = TRUE, read_at = NOW()
  WHERE swap_id = swap_uuid
    AND sender_id != user_uuid
    AND is_read = FALSE;
$$ LANGUAGE SQL;

-- Function to check if user can request swap
CREATE OR REPLACE FUNCTION can_request_swap(user_uuid UUID, post_uuid UUID)
RETURNS BOOLEAN AS $$
  DECLARE
    post_owner UUID;
    existing_request UUID;
  BEGIN
    -- Check if user is post owner
    SELECT user_id INTO post_owner FROM public.posts WHERE id = post_uuid;
    IF post_owner = user_uuid THEN
      RETURN FALSE; -- Can't swap own book
    END IF;
    
    -- Check for existing pending request
    SELECT id INTO existing_request 
    FROM public.swaps 
    WHERE post_id = post_uuid 
      AND requester_id = user_uuid 
      AND status = 'pending';
    
    IF existing_request IS NOT NULL THEN
      RETURN FALSE; -- Already has pending request
    END IF;
    
    RETURN TRUE;
  END;
$$ LANGUAGE plpgsql;


--- Ensure users.total_swaps exists


-- Add total_swaps column if it doesn't exist
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS total_swaps INTEGER DEFAULT 0;

-- Add constraint to ensure non-negative
ALTER TABLE public.users
ADD CONSTRAINT total_swaps_non_negative CHECK (total_swaps >= 0);


--- 6. Ensure posts.availability exists


-- Verify availability column exists (should from Phase 2)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'availability'
  ) THEN
    ALTER TABLE public.posts
    ADD COLUMN availability TEXT DEFAULT 'available' 
    CHECK (availability IN ('available', 'pending', 'swapped'));
  END IF;
END $$;

