export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
export type MeetupStatus = 'none' | 'proposed' | 'agreed';
export type VenueCategory =
  | 'coffee_shop'
  | 'library'
  | 'bookshop'
  | 'bar'
  | 'book_club'
  | 'community_space'
  | 'other';

export interface Swap {
  id: string;
  requester_id: string;
  owner_id: string;
  post_id: string;
  status: SwapStatus;
  request_message?: string;
  requester_confirmed_complete: boolean;
  owner_confirmed_complete: boolean;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  completed_at?: string;

  // Meetup location coordination
  meetup_status: MeetupStatus;
  meetup_proposed_by?: string | null;
  meetup_venue_name?: string | null;
  meetup_venue_address?: string | null;
  meetup_venue_category?: VenueCategory | null;
  meetup_proposed_at?: string | null;
  meetup_agreed_at?: string | null;

  // Joined data
  requester?: {
    id: string;
    username: string;
    avatar_url?: string;
    city?: string | null;
  };
  owner?: {
    id: string;
    username: string;
    avatar_url?: string;
    city?: string | null;
  };
  post?: {
    id: string;
    title: string;
    author?: string;
    cover_image_url?: string;
    image_url?: string;
  };
  unread_count?: number;
}
