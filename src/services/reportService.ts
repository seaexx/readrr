import { supabase } from '../config/supabase';

export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reason: string,
  details?: string
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason,
      details: details?.trim() || null,
    });

  if (error) throw error;
}

export async function reportPost(
  reporterId: string,
  postId: string,
  reason: string,
  details?: string
): Promise<void> {
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_post_id: postId,
      reason,
      details: details?.trim() || null,
    });

  if (error) throw error;
}
