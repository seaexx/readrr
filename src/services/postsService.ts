import { supabase } from '../config/supabase';
import { Post, CreatePostInput } from '../models/Post';

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

export async function getSwapPosts(limit = 20, offset = 0, blockedUserIds: string[] = []): Promise<Post[]> {
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
