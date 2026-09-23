import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { fonts } from '../../theme/fonts';
import SafeAreaView from '../../components/SafeAreaView';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { BookInfo } from '../../services/booksService';
import BookCover from '../../components/BookCover';
import BookFinder from '../../components/BookFinder';

interface Props {
  navigation: any;
}

export default function FirstPostScreen({ navigation }: Props) {
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, setHasPosted } = useAuthStore();

  const handlePostBook = async () => {
    if (!bookInfo || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        post_type: 'social',
        social_type: 'currently_reading',
        title: bookInfo.title,
        author: bookInfo.author,
        isbn: bookInfo.isbn,
        cover_image_url: bookInfo.cover_image_url,
      });

      if (error) throw error;

      // Update hasPosted state so the Feed prompt disappears, then go back
      setHasPosted(true);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  // Book confirmation screen
  if (bookInfo) {
    return (
      <SafeAreaView className="flex-1 bg-white px-6">
        <Text className="text-2xl mt-8 mb-6" style={{ fontFamily: fonts.serifBold }}>Your First Book!</Text>

        <View className="flex-row bg-gray-50 rounded-xl p-4 mb-6">
          <BookCover
            coverUrl={bookInfo.cover_image_url}
            width={80}
            height={120}
            style={{ borderRadius: 8, marginRight: 16 }}
          />
          <View className="flex-1 justify-center">
            <Text className="text-xl font-semibold mb-2">{bookInfo.title}</Text>
            <Text className="text-gray-500">{bookInfo.author}</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handlePostBook}
          disabled={loading}
          className={`py-4 rounded-xl ${loading ? 'bg-gray-300' : 'bg-primary'}`}
        >
          <Text className="text-white text-center font-semibold text-lg">
            {loading ? 'Posting...' : 'Post This Book'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setBookInfo(null);
          }}
          className="mt-4"
        >
          <Text className="text-primary text-center">Choose Different Book</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <BookFinder
      onSelect={setBookInfo}
      onCancel={() => navigation.goBack()}
      title="Add Your First Book"
    />
  );
}
