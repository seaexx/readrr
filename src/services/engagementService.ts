import { supabase } from '../config/supabase';
import { Like, Comment } from '../models/Post';
import { sendPushNotification } from './notificationsService';

// ============================================
// LIKES
// ============================================

export async function likePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .insert({
      post_id: postId,
      user_id: userId,
    });

  if (error) throw error;

  // Notify the post owner
  try {
    const { data: post } = await supabase
      .from('posts')
      .select('user_id, title')
      .eq('id', postId)
      .single();

    const { data: liker } = await supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single();

    if (post && post.user_id !== userId && liker) {
      await sendPushNotification(
        post.user_id,
        `@${liker.username} liked your post`,
        `"${post.title}"`,
        { type: 'like', postId }
      );
    }
  } catch (e) {
    // Don't fail the like if notification fails
  }
}

export async function unlikePost(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('likes')
    .delete()
    .match({ post_id: postId, user_id: userId });

  if (error) throw error;
}

export async function getPostLikes(postId: string): Promise<Like[]> {
  const { data, error } = await supabase
    .from('likes')
    .select('*, user:users(username, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getLikeCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) throw error;
  return count || 0;
}

export async function hasUserLiked(postId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('likes')
    .select('id')
    .match({ post_id: postId, user_id: userId })
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// ============================================
// COMMENTS
// ============================================

export async function createComment(
  postId: string,
  userId: string,
  content: string
): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({
      post_id: postId,
      user_id: userId,
      content,
    })
    .select('*, user:users(username, avatar_url)')
    .single();

  if (error) throw error;
  return data;
}

export async function getPostComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, user:users(username, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
}

export async function getCommentCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) throw error;
  return count || 0;
}
