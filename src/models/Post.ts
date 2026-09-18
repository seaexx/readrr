export type PostType = 'social' | 'swap';
export type Condition = 'new' | 'like_new' | 'good' | 'acceptable' | 'poor';
export type SwapType = 'trade' | 'borrow' | 'gift';
export type Availability = 'available' | 'pending' | 'swapped';

export interface Post {
  id: string;
  user_id: string;
  isbn?: string;
  title: string;
  author?: string;
  cover_image_url?: string;
  post_type: PostType;
  image_url?: string;
  caption?: string;
  condition?: Condition;
  genre?: string;
  swap_type?: SwapType;
  availability?: Availability;
  location?: string; // WKT format: POINT(lng lat)
  distance_miles?: number; // Populated by get_nearby_swap_posts RPC
  created_at: string;
  updated_at: string;

  // Joined data (from queries)
  user?: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  like_count?: number;
  comment_count?: number;
  has_liked?: boolean;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  user?: {
    username: string;
    avatar_url?: string;
  };
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    username: string;
    avatar_url?: string;
  };
}

export interface CreatePostInput {
  user_id: string;
  post_type: PostType;
  isbn?: string | null;
  title: string;
  author?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  caption?: string | null;
  condition?: Condition | null;
  genre?: string | null;
  swap_type?: SwapType | null;
  availability?: Availability;
  location?: string | null; // WKT format: POINT(lng lat)
}
