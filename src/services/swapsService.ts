import { supabase } from '../config/supabase';
import { Swap, VenueCategory } from '../models/Swap';
import { sendPushNotification } from './notificationsService';

// Check if user can request a swap for a post
export async function canRequestSwap(userId: string, postId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_request_swap', {
    user_uuid: userId,
    post_uuid: postId,
  });

  if (error) {
    console.error('Error checking swap eligibility:', error);
    return false;
  }

  return data === true;
}

// Create a new swap request
export async function createSwapRequest(
  requesterId: string,
  ownerId: string,
  postId: string,
  message?: string
): Promise<Swap> {
  const { data, error } = await supabase
    .from('swaps')
    .insert({
      requester_id: requesterId,
      owner_id: ownerId,
      post_id: postId,
      request_message: message || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get swaps received by user (as owner)
export async function getReceivedSwaps(userId: string): Promise<Swap[]> {
  const { data, error } = await supabase
    .from('swaps')
    .select(`
      *,
      requester:users!swaps_requester_id_fkey(id, username, avatar_url),
      post:posts(id, title, author, cover_image_url, image_url)
    `)
    .eq('owner_id', userId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get swaps sent by user (as requester)
export async function getSentSwaps(userId: string): Promise<Swap[]> {
  const { data, error } = await supabase
    .from('swaps')
    .select(`
      *,
      owner:users!swaps_owner_id_fkey(id, username, avatar_url),
      post:posts(id, title, author, cover_image_url, image_url)
    `)
    .eq('requester_id', userId)
    .in('status', ['pending', 'accepted'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get a single swap by ID
export async function getSwap(swapId: string): Promise<Swap | null> {
  const { data, error } = await supabase
    .from('swaps')
    .select(`
      *,
      requester:users!swaps_requester_id_fkey(id, username, avatar_url, city),
      owner:users!swaps_owner_id_fkey(id, username, avatar_url, city),
      post:posts(id, title, author, cover_image_url, image_url)
    `)
    .eq('id', swapId)
    .single();

  if (error) {
    console.error('Error getting swap:', error);
    return null;
  }
  return data;
}

// Accept a swap request (owner only)
export async function acceptSwap(swapId: string): Promise<void> {
  const { error } = await supabase
    .from('swaps')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', swapId);

  if (error) throw error;

  // Notify the requester
  const { data: swap } = await supabase
    .from('swaps')
    .select('requester_id, owner:users!swaps_owner_id_fkey(username)')
    .eq('id', swapId)
    .single();

  if (swap) {
    sendPushNotification(
      swap.requester_id,
      'Swap accepted! 🎉',
      `@${(swap.owner as any)?.username} accepted your swap request`
    ).catch(() => {});
  }
}

// Decline a swap request (owner only)
export async function declineSwap(swapId: string): Promise<void> {
  const { error } = await supabase
    .from('swaps')
    .update({ status: 'declined' })
    .eq('id', swapId);

  if (error) throw error;
}

// Cancel a swap request (requester only)
export async function cancelSwap(swapId: string): Promise<void> {
  const { error } = await supabase
    .from('swaps')
    .update({ status: 'cancelled' })
    .eq('id', swapId);

  if (error) throw error;
}

// Mark swap as complete (for one user)
export async function confirmSwapComplete(
  swapId: string,
  userId: string,
  isOwner: boolean
): Promise<{ bothConfirmed: boolean }> {
  // First update the confirmation field
  const updateField = isOwner ? 'owner_confirmed_complete' : 'requester_confirmed_complete';

  const { error: updateError } = await supabase
    .from('swaps')
    .update({ [updateField]: true })
    .eq('id', swapId);

  if (updateError) throw updateError;

  // Check if both have confirmed
  const { data: swap, error: fetchError } = await supabase
    .from('swaps')
    .select('requester_confirmed_complete, owner_confirmed_complete, requester_id, owner_id, post_id')
    .eq('id', swapId)
    .single();

  if (fetchError) throw fetchError;

  const bothConfirmed = swap.requester_confirmed_complete && swap.owner_confirmed_complete;

  if (bothConfirmed) {
    // Update swap status to completed
    await supabase
      .from('swaps')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', swapId);

    // total_swaps is incremented by DB trigger (009_total_swaps_trigger.sql)

    // Update post availability to 'swapped'
    await supabase
      .from('posts')
      .update({ availability: 'swapped' })
      .eq('id', swap.post_id);
  }

  return { bothConfirmed };
}

// Check if user has pending swap request for a post
export async function hasPendingRequest(userId: string, postId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('swaps')
    .select('id')
    .eq('requester_id', userId)
    .eq('post_id', postId)
    .eq('status', 'pending')
    .maybeSingle();

  if (error) {
    console.error('Error checking pending request:', error);
    return false;
  }

  return data !== null;
}

// Propose a meetup location (or counter-propose by overwriting)
export async function proposeMeetup(
  swapId: string,
  proposedById: string,
  venueName: string,
  venueCategory: VenueCategory,
  venueAddress?: string
): Promise<void> {
  const { error } = await supabase
    .from('swaps')
    .update({
      meetup_status: 'proposed',
      meetup_proposed_by: proposedById,
      meetup_venue_name: venueName,
      meetup_venue_category: venueCategory,
      meetup_venue_address: venueAddress || null,
      meetup_proposed_at: new Date().toISOString(),
      meetup_agreed_at: null,
    })
    .eq('id', swapId);

  if (error) throw error;

  // Notify the other party
  const { data: swap } = await supabase
    .from('swaps')
    .select('requester_id, owner_id, proposer:users!swaps_meetup_proposed_by_fkey(username)')
    .eq('id', swapId)
    .single();

  if (swap) {
    const toUserId = swap.requester_id === proposedById ? swap.owner_id : swap.requester_id;
    sendPushNotification(
      toUserId,
      'Meetup suggested 📍',
      `@${(swap.proposer as any)?.username} suggested ${venueName} as a meetup spot`
    ).catch(() => {});
  }
}

// Accept the proposed meetup location
export async function acceptMeetup(swapId: string): Promise<void> {
  const { error } = await supabase
    .from('swaps')
    .update({
      meetup_status: 'agreed',
      meetup_agreed_at: new Date().toISOString(),
    })
    .eq('id', swapId);

  if (error) throw error;

  // Notify the proposer
  const { data: swap } = await supabase
    .from('swaps')
    .select('meetup_proposed_by, meetup_venue_name, accepter:users!swaps_owner_id_fkey(username)')
    .eq('id', swapId)
    .single();

  if (swap?.meetup_proposed_by) {
    sendPushNotification(
      swap.meetup_proposed_by,
      'Meetup confirmed ✅',
      `Your suggested meetup at ${swap.meetup_venue_name} was accepted!`
    ).catch(() => {});
  }
}

// Reset meetup back to none (either party can clear)
export async function clearMeetup(swapId: string): Promise<void> {
  const { error } = await supabase
    .from('swaps')
    .update({
      meetup_status: 'none',
      meetup_proposed_by: null,
      meetup_venue_name: null,
      meetup_venue_category: null,
      meetup_venue_address: null,
      meetup_proposed_at: null,
      meetup_agreed_at: null,
    })
    .eq('id', swapId);

  if (error) throw error;
}

// Get unread message count for a swap
export async function getUnreadCount(swapId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_count', {
    swap_uuid: swapId,
    user_uuid: userId,
  });

  if (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }

  return data || 0;
}
