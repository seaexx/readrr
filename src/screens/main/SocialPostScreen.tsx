import { useState } from 'react';
import { fonts } from '../../theme/fonts';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { Image } from 'expo-image';
import BookCover from '../../components/BookCover';
import BookFinder from '../../components/BookFinder';
import { BookInfo } from '../../services/booksService';
import { createPost } from '../../services/postsService';
import { useAuthStore } from '../../store/authStore';

interface Props {
  navigation: any;
}

export default function SocialPostScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const setHasPosted = useAuthStore((state) => state.setHasPosted);

  const [findingBook, setFindingBook] = useState(false);
  const [book, setBook] = useState<BookInfo | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    if (!book || !session) {
      Alert.alert('Error', 'Please select a book');
      return;
    }

    setLoading(true);

    try {
      console.log('📝 Creating post with cover_image_url:', book.cover_image_url);

      await createPost({
        user_id: session.user.id,
        post_type: 'social',
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        cover_image_url: book.cover_image_url,
        caption: caption || null,
      });

      navigation.navigate('MainTabs', { screen: 'Feed' });
      setHasPosted(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  if (findingBook) {
    return (
      <BookFinder
        onSelect={(b) => {
          setBook(b);
          setFindingBook(false);
        }}
        onCancel={() => setFindingBook(false)}
        title="Choose a Book"
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
              <Text className="text-primary text-base">← Back</Text>
            </TouchableOpacity>

            <Text className="text-2xl mb-6" style={{ fontFamily: fonts.serifBold }}>Share What You're Reading</Text>

            {/* Book Selection */}
            {book ? (
              <View className="flex-row mb-6 bg-gray-50 rounded-xl p-4">
                <BookCover
                  coverUrl={book.cover_image_url}
                  width={60}
                  height={90}
                  style={{ borderRadius: 4, marginRight: 16 }}
                />
                <View className="flex-1 justify-center">
                  <Text className="font-semibold text-base" style={{ marginBottom: 4 }}>{book.title}</Text>
                  <Text className="text-gray-600 text-sm">{book.author}</Text>
                  <TouchableOpacity onPress={() => setBook(null)} className="mt-2">
                    <Text className="text-primary text-sm">Change book</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View className="mb-6">
                <TouchableOpacity
                  onPress={() => setFindingBook(true)}
                  className="bg-primary py-4 rounded-xl"
                >
                  <Text className="text-white text-center font-semibold">
                    Find a Book
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Caption */}
            <Text className="text-sm font-semibold mb-2">Caption (optional)</Text>
            <TextInput
              placeholder="What do you think about this book?"
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={4}
              maxLength={500}
              style={styles.textArea}
            />
            <Text className="text-gray-400 text-xs text-right mb-6">
              {caption.length}/500
            </Text>

            {/* Post Button */}
            <TouchableOpacity
              onPress={handlePost}
              disabled={!book || loading}
              className={`py-4 rounded-xl ${
                !book || loading ? 'bg-gray-300' : 'bg-primary'
              }`}
            >
              <Text className="text-white text-center font-semibold text-lg">
                {loading ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  isbnInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 16,
  },
});
