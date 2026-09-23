import { Alert } from 'react-native';
import { saveToShelf, ShelfName, ShelfBookInput } from '../services/shelfService';
import { notifyPostOwner } from '../services/engagementService';

const OPTIONS: { label: string; value: ShelfName }[] = [
  { label: 'Want to Read', value: 'want_to_read' },
  { label: 'Currently Reading', value: 'reading' },
  { label: 'Finished', value: 'finished' },
];

// Action sheet to save a book onto one of the three shelves.
// If the book is already shelved anywhere it is moved instead.
// Pass `fromPostId` when saving from someone's post so they get notified
// (only on the first save, not when moving between shelves).
export function promptSaveToShelf(
  userId: string,
  book: ShelfBookInput,
  onSaved?: () => void,
  fromPostId?: { postId: string; alreadySaved: boolean }
) {
  Alert.alert('Save to Shelf', `"${book.title}" by ${book.author || 'Unknown Author'}`, [
    ...OPTIONS.map((o) => ({
      text: o.label,
      onPress: async () => {
        try {
          await saveToShelf(userId, book, o.value);
          onSaved?.();
          if (fromPostId && !fromPostId.alreadySaved) {
            notifyPostOwner(fromPostId.postId, userId, (username, title) => ({
              title: `@${username} saved your book`,
              body: `"${title}" is on their ${o.label} shelf`,
              type: 'shelf_add',
            }));
          }
          Alert.alert('Saved', `Added to ${o.label}.`);
        } catch {
          Alert.alert('Error', 'Could not save. Please try again.');
        }
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
