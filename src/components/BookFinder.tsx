import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BarcodeScanner from './BarcodeScanner';
import BookCover from './BookCover';
import { fetchBookByISBN, searchBooks, BookInfo } from '../services/booksService';
import { MagnifyingGlass, Barcode, PencilSimple, X } from 'phosphor-react-native';
import { fonts } from '../theme/fonts';

const styles = StyleSheet.create({
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
});

interface Props {
  onSelect: (book: BookInfo) => void;
  onCancel?: () => void;
  title?: string;
}

type Mode = 'choice' | 'scan' | 'search' | 'manual';

// Shared book picker: barcode scan, title/author search (Open Library),
// or manual title+author entry when the catalog misses a book.
// Emits a BookInfo (isbn may be null for manual entries).
export default function BookFinder({ onSelect, onCancel, title = 'Find a Book' }: Props) {
  const [mode, setMode] = useState<Mode>('choice');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');

  const handleBarcodeScanned = async (isbn: string) => {
    setMode('choice');
    setLookingUp(true);
    try {
      const book = await fetchBookByISBN(isbn);
      onSelect(book);
    } catch {
      Alert.alert('Book Not Found', 'Could not find that ISBN. Try searching by title or enter it manually.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const books = await searchBooks(q);
      setResults(books);
    } catch {
      Alert.alert('Search Failed', 'Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleManualSubmit = () => {
    const bookTitle = manualTitle.trim();
    if (!bookTitle) {
      Alert.alert('Title Required', 'Please enter at least a book title.');
      return;
    }
    onSelect({
      isbn: null,
      title: bookTitle,
      author: manualAuthor.trim() || 'Unknown Author',
      cover_image_url: null,
    });
  };

  if (mode === 'scan') {
    return (
      <BarcodeScanner
        onBarcodeScanned={handleBarcodeScanned}
        onCancel={() => setMode('choice')}
        title="Scan Book Barcode"
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6">
      {onCancel && (
        <TouchableOpacity onPress={onCancel} className="mt-4 mb-4">
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
      )}

      <Text className="text-2xl mb-2" style={{ fontFamily: fonts.serifBold }}>{title}</Text>
      <Text className="text-gray-500 mb-6">Scan, search, or enter it yourself</Text>

      {mode === 'choice' && (
        <>
          <TouchableOpacity
            onPress={() => setMode('scan')}
            className="bg-primary py-4 rounded-xl mb-3 flex-row items-center justify-center"
            style={{ gap: 8 }}
          >
            <Barcode size={20} color="#fff" weight="regular" />
            <Text className="text-white text-center font-semibold text-lg">Scan Barcode</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('search')}
            className="border border-primary py-4 rounded-xl mb-3 flex-row items-center justify-center"
            style={{ gap: 8 }}
          >
            <MagnifyingGlass size={20} color="#38B6FF" weight="regular" />
            <Text className="text-primary text-center font-semibold text-lg">Search by Title or Author</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode('manual')} className="py-3">
            <Text className="text-gray-500 text-center">Can't find it? Enter it manually</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'search' && (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#f3f4f6',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginBottom: 12,
            }}
          >
            <MagnifyingGlass size={16} color="#9ca3af" weight="regular" style={{ marginRight: 8 }} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Title or author…"
              placeholderTextColor="#9ca3af"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              style={{ flex: 1, fontSize: 16, color: '#1f2937' }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
                <X size={16} color="#9ca3af" weight="regular" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={handleSearch}
            disabled={!query.trim() || searching}
            className={`py-3 rounded-xl mb-4 ${query.trim() && !searching ? 'bg-primary' : 'bg-gray-200'}`}
          >
            {searching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-semibold">Search</Text>
            )}
          </TouchableOpacity>

          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.isbn || item.title}-${index}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onSelect(item)}
                className="flex-row items-center py-3 border-b border-gray-100"
              >
                <BookCover coverUrl={item.cover_image_url} width={44} height={64} style={{ borderRadius: 4 }} />
                <View className="ml-3 flex-1">
                  <Text style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
                  <Text style={{ fontSize: 13, color: '#6b7280' }} numberOfLines={1}>{item.author}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              hasSearched && !searching ? (
                <View className="items-center py-8">
                  <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', marginBottom: 12 }}>
                    No results for "{query}"
                  </Text>
                  <TouchableOpacity onPress={() => setMode('manual')}>
                    <Text style={{ fontSize: 15, color: '#38B6FF', fontWeight: '600' }}>
                      Enter it manually instead
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />

          <TouchableOpacity onPress={() => setMode('choice')} className="py-3">
            <Text className="text-gray-500 text-center">← All options</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'manual' && (
        <>
          <Text className="text-sm text-gray-600 mb-2">Book title *</Text>
          <TextInput
            value={manualTitle}
            onChangeText={setManualTitle}
            placeholder="e.g. The Left Hand of Darkness"
            placeholderTextColor="#9ca3af"
            style={styles.textInput}
          />
          <Text className="text-sm text-gray-600 mb-2">Author</Text>
          <TextInput
            value={manualAuthor}
            onChangeText={setManualAuthor}
            placeholder="e.g. Ursula K. Le Guin"
            placeholderTextColor="#9ca3af"
            style={styles.textInput}
          />
          <TouchableOpacity
            onPress={handleManualSubmit}
            disabled={!manualTitle.trim()}
            className={`py-4 rounded-xl flex-row items-center justify-center ${manualTitle.trim() ? 'bg-primary' : 'bg-gray-300'}`}
            style={{ gap: 8 }}
          >
            <PencilSimple size={18} color="#fff" weight="regular" />
            <Text className="text-white text-center font-semibold text-lg">Use This Book</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('choice')} className="py-3 mt-2">
            <Text className="text-gray-500 text-center">← All options</Text>
          </TouchableOpacity>
        </>
      )}

      {lookingUp && (
        <View className="absolute inset-0 bg-white/80 items-center justify-center">
          <ActivityIndicator size="large" color="#38B6FF" />
          <Text style={{ marginTop: 12, color: '#6b7280' }}>Looking up book…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
