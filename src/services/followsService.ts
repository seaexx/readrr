import { supabase } from '../config/supabase';

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });

  if (error) throw error;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .match({ follower_id: followerId, following_id: followingId });

  if (error) throw error;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('id')
    .match({ follower_id: followerId, following_id: followingId })
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_follower_count', { user_uuid: userId });
  if (error) throw error;
  return data || 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_following_count', { user_uuid: userId });
  if (error) throw error;
  return data || 0;
}

export interface FollowUser {
  id: string;
  username: string;
  avatar_url: string | null;
  city: string | null;
}

export async function getFollowers(userId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('follower:users!follows_follower_id_fkey(id, username, avatar_url, city)')
    .eq('following_id', userId);

  if (error) throw error;
  return (data || []).map((row: any) => row.follower);
}

export async function getFollowing(userId: string): Promise<FollowUser[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following:users!follows_following_id_fkey(id, username, avatar_url, city)')
    .eq('follower_id', userId);

  if (error) throw error;
  return (data || []).map((row: any) => row.following);
}
