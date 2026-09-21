import { supabase } from '../config/supabase';
import { sendPushNotification } from './notificationsService';

interface WishlistRecipient {
  user_id: string;
  distance_miles: number;
}

// After a swap post is created, alert every OTHER reader who has that book on
// their want-to-read shelf and is within range. Matching (title + proximity +
// blocks) happens server-side in the get_wishlist_match_recipients RPC
// (migration 018); here we just fan out the notifications.
//
// Fire-and-forget: never throws, never blocks post creation.
export async function notifyWishlistMatches(postId: string, bookTitle: string): Promise<void> {
  try {
    const { data, error } = await supabase.rpc('get_wishlist_match_recipients', {
      new_post_id: postId,
    });

    if (error) {
      console.error('wishlist match RPC error:', error);
      return;
    }

    const recipients = (data as WishlistRecipient[]) || [];
    if (recipients.length === 0) return;

    await Promise.all(
      recipients.map((r) => {
        const miles = r.distance_miles < 0.1 ? '<0.1' : r.distance_miles.toFixed(1);
        return sendPushNotification(
          r.user_id,
          'On your wishlist, nearby',
          `"${bookTitle}" is now available ${miles} mi away`,
          { type: 'wishlist_match', postId }
        ).catch(() => {});
      })
    );
  } catch (e) {
    console.error('notifyWishlistMatches failed:', e);
  }
}
