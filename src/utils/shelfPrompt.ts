import { Alert } from 'react-native';
import { saveToShelf, ShelfName, ShelfBookInput } from '../services/shelfService';

const OPTIONS: { label: string; value: ShelfName }[] = [
  { label: 'Want to Read', value: 'want_to_read' },
  { label: 'Currently Reading', value: 'reading' },
  { label: 'Finished', value: 'finished' },
];

// Action sheet to save a book onto one of the three shelves.
// If the book is already shelved anywhere it is moved instead.
export function promptSaveToShelf(userId: string, book: ShelfBookInput) {
  Alert.alert('Save to Shelf', `"${book.title}" by ${book.author || 'Unknown Author'}`, [
    ...OPTIONS.map((o) => ({
      text: o.label,
      onPress: async () => {
        try {
          await saveToShelf(userId, book, o.value);
          Alert.alert('Saved', `Added to ${o.label}.`);
        } catch {
          Alert.alert('Error', 'Could not save. Please try again.');
        }
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
