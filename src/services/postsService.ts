import { supabase } from '../config/supabase';
import { Post, CreatePostInput } from '../models/Post';
import { notifyWishlistMatches } from './wishlistService';

export async function createPost(data: CreatePostInput): Promise<Post> {
  console.log('💾 postsService.createPost data:', JSON.stringify(data, null, 2));

  const { data: post, error } = await supabase
    .from('posts')
    .insert(data)
    .select('*, user:users(id, username, avatar_url)')
    .single();

  if (error) {
    console.log('❌ createPost error:', error);
    throw error;
  }

  console.log('✅ Post created:', JSON.stringify(post, null, 2));

  // Fire-and-forget: alert nearby readers who have this book on their wishlist.
  if (post?.post_type === 'swap' && data.location) {
    void notifyWishlistMatches(post.id, post.title);
  }

  return post;
}

export async function getPost(postId: string): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users(id, username, avatar_url)')
    .eq('id', postId)
    .single();

  if (error) throw error;
  return data;
}

export async function getFeedPosts(limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users(id, username, avatar_url)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getSocialPosts(limit = 20, offset = 0, blockedUserIds: string[] = []): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select('*, user:users(id, username, avatar_url)')
    .eq('post_type', 'social');

  if (blockedUserIds.length > 0) {
    query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getSwapPosts(
  limit = 20,
  offset = 0,
  blockedUserIds: string[] = [],
  userLocation?: { latitude: number; longitude: number } | null,
  radiusMiles = 25
): Promise<Post[]> {
  // Location-aware path: RPC that filters + sorts by distance
  if (userLocation) {
    const { data, error } = await supabase.rpc('get_nearby_swap_posts', {
      user_lat: userLocation.latitude,
      user_lon: userLocation.longitude,
      radius_miles: radiusMiles,
      result_limit: limit,
      result_offset: offset,
      blocked_ids: blockedUserIds.length > 0 ? blockedUserIds : [],
    });

    if (error) throw error;

    return ((data as any[]) || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      cover_image_url: row.cover_image_url,
      image_url: row.image_url,
      cover_url: row.cover_url,
      post_type: row.post_type,
      condition: row.condition,
      genre: row.genre,
      swap_type: row.swap_type,
      availability: row.availability,
      location: undefined,
      distance_miles: row.distance_miles,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: {
        id: row.user_id,
        username: row.username,
        avatar_url: row.avatar_url,
      },
    })) as Post[];
  }

  // Fallback: no location available — show all available swaps newest-first
  let query = supabase
    .from('posts')
    .select('*, user:users(id, username, avatar_url)')
    .eq('post_type', 'swap')
    .eq('availability', 'available');

  if (blockedUserIds.length > 0) {
    query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getUserPosts(userId: string, limit = 20, offset = 0): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*, user:users(id, username, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) throw error;
}

export async function updatePostAvailability(
  postId: string,
  availability: 'available' | 'pending' | 'swapped'
): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ availability })
    .eq('id', postId);

  if (error) throw error;
}

// Persist the user's current location so proximity features (nearby feed,
// wishlist match alerts) can find them. WKT order is POINT(lon lat).
export async function updateUserLocation(
  userId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  try {
    await supabase
      .from('users')
      .update({ location: `POINT(${longitude} ${latitude})` })
      .eq('id', userId);
  } catch (e) {
    console.error('updateUserLocation failed:', e);
  }
}
