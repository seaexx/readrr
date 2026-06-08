import { supabase } from '../config/supabase';

export interface Rating {
  id: string;
  swap_id: string;
  rater_id: string;
  rated_id: string;
  score: number;
  comment: string | null;
  created_at: string;
  rater?: { id: string; username: string; avatar_url: string | null };
}

export async function submitRating(
  swapId: string,
  raterId: string,
  ratedId: string,
  score: number,
  comment?: string
): Promise<Rating> {
  const { data, error } = await supabase
    .from('ratings')
    .insert({
      swap_id: swapId,
      rater_id: raterId,
      rated_id: ratedId,
      score,
      comment: comment?.trim() || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function hasRated(swapId: string, raterId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ratings')
    .select('id')
    .match({ swap_id: swapId, rater_id: raterId })
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function getUserRatings(userId: string): Promise<Rating[]> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*, rater:users!ratings_rater_id_fkey(id, username, avatar_url)')
    .eq('rated_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
