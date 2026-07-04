import { supabase } from '../config/supabase';

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .match({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) throw error;
}

export async function isBlocked(userA: string, userB: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('id')
    .or(`and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export async function getBlockedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_blocked_user_ids', { user_uuid: userId });

  if (error) throw error;
  return (data || []) as string[];
}
