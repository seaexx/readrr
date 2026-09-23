import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Linking,
} from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import BookCover from '../../components/BookCover';
import BookFinder from '../../components/BookFinder';
import { BookInfo } from '../../services/booksService';
import { createPost } from '../../services/postsService';
import { uploadPostImage } from '../../services/storageService';
import { useAuthStore } from '../../store/authStore';
import { Camera, ArrowLeft } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';
import { Condition, SwapType } from '../../models/Post';

interface Props {
  navigation: any;
}

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'poor', label: 'Poor' },
];

const GENRES = [
  'Fiction',
  'Non-Fiction',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Fantasy',
  'Biography',
  'Self-Help',
  'History',
  'Other',
];

const SWAP_TYPES: { value: SwapType; label: string }[] = [
  { value: 'trade', label: 'Trade' },
  { value: 'borrow', label: 'Lend' },
  { value: 'gift', label: 'Gift' },
];

export default function SwapPostScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const setHasPosted = useAuthStore((state) => state.setHasPosted);

  const [findingBook, setFindingBook] = useState(false);
  const [book, setBook] = useState<BookInfo | null>(null);
  const [bookImage, setBookImage] = useState<string | null>(null);
  const [condition, setCondition] = useState<Condition | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [swapType, setSwapType] = useState<SwapType>('trade');
  const [loading, setLoading] = useState(false);

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.8,
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera access needed',
        'Allow camera access in Settings to take a photo of your book.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!result.canceled) {
      setBookImage(result.assets[0].uri);
    }
  };

  const chooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need permission to access your photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!result.canceled) {
      setBookImage(result.assets[0].uri);
    }
  };

  const pickImage = () => {
    Alert.alert(bookImage ? 'Change photo' : 'Add a photo of your book', undefined, [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: chooseFromLibrary },
      ...(bookImage
        ? [{ text: 'Remove Photo', style: 'destructive' as const, onPress: () => setBookImage(null) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const handlePost = async () => {
    if (!book || !bookImage || !condition || !genre || !session) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Get user's location (as WKT string for PostGIS)
      let location: string | null = null;
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        // Convert to WKT format: POINT(longitude latitude)
        location = `POINT(${loc.coords.longitude} ${loc.coords.latitude})`;
      }

      // Upload image with one automatic retry for transient failures
      let imageUrl: string;
      try {
        imageUrl = await uploadPostImage(bookImage, session.user.id);
      } catch (uploadError: any) {
        // Wait a moment then retry once
        await new Promise((r) => setTimeout(r, 1000));
        imageUrl = await uploadPostImage(bookImage, session.user.id);
      }

      // Create post
      await createPost({
        user_id: session.user.id,
        post_type: 'swap',
        isbn: book.isbn,
        title: book.title,
        author: book.author,
        cover_image_url: book.cover_image_url,
        image_url: imageUrl,
        condition,
        genre,
        swap_type: swapType,
        availability: 'available',
        location,
      });

      navigation.navigate('MainTabs', { screen: 'Swaps' });
      setHasPosted(true);
    } catch (error: any) {
      // 23505 = unique violation from the one-active-listing-per-book index (019)
      if (error?.code === '23505') {
        Alert.alert('Already listed', `You already have "${book.title}" up for swap — hide or delete that listing first.`);
        return;
      }
      const msg = error.message || 'Failed to create post';
      const isUploadError =
        msg.toLowerCase().includes('upload') ||
        msg.toLowerCase().includes('storage') ||
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch');
      if (isUploadError) {
        Alert.alert('Photo Upload Failed', 'Could not upload your book photo. Check your connection and try again.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handlePost() },
        ]);
      } else {
        Alert.alert('Error', msg);
      }
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

  const isValid = book && bookImage && condition && genre;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-4 pb-10">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><ArrowLeft size={16} color="#38B6FF" weight="regular" /><Text className="text-primary text-base">Back</Text></View>
          </TouchableOpacity>

          <Text className="text-2xl mb-6" style={{ fontFamily: fonts.serifBold }}>Post Book for Swap</Text>

          {/* Book Info */}
          {book ? (
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-2">Book</Text>
              <View className="flex-row bg-gray-50 rounded-xl p-4">
                <BookCover
                  coverUrl={book.cover_image_url}
                  width={60}
                  height={90}
                  style={{ borderRadius: 4, marginRight: 16 }}
                />
                <View className="flex-1 justify-center">
                  <Text className="font-semibold" style={{ marginBottom: 4 }}>{book.title}</Text>
                  <Text className="text-gray-600 text-sm">{book.author}</Text>
                  <TouchableOpacity onPress={() => setBook(null)}>
                    <Text className="text-primary text-sm mt-2">Change</Text>
                  </TouchableOpacity>
                </View>
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

          {/* Book Photo */}
          <Text className="text-sm font-semibold mb-2">Photo of Book *</Text>
          <TouchableOpacity onPress={pickImage} className="mb-6">
            {bookImage ? (
              <Image
                source={{ uri: bookImage }}
                style={{ width: '100%', height: 200, borderRadius: 12 }}
              />
            ) : (
              <View className="w-full h-48 bg-gray-100 rounded-xl items-center justify-center">
                <Camera size={40} color="#9ca3af" weight="duotone" style={{ marginBottom: 8 }} />
                <Text className="text-gray-500">Take or choose a photo of your book</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Condition */}
          <Text className="text-sm font-semibold mb-2">Condition *</Text>
          <View className="flex-row flex-wrap mb-6">
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCondition(c.value)}
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  condition === c.value ? 'bg-primary' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={condition === c.value ? 'text-white' : 'text-gray-700'}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Genre */}
          <Text className="text-sm font-semibold mb-2">Genre *</Text>
          <View className="flex-row flex-wrap mb-6">
            {GENRES.map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGenre(g)}
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  genre === g ? 'bg-primary' : 'bg-gray-100'
                }`}
              >
                <Text className={genre === g ? 'text-white' : 'text-gray-700'}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Swap Type */}
          <Text className="text-sm font-semibold mb-2">I want to *</Text>
          <View className="flex-row mb-6">
            {SWAP_TYPES.map((s) => (
              <TouchableOpacity
                key={s.value}
                onPress={() => setSwapType(s.value)}
                className={`flex-1 py-3 rounded-xl mr-2 ${
                  swapType === s.value ? 'bg-primary' : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-center font-semibold ${
                    swapType === s.value ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Post Button */}
          <TouchableOpacity
            onPress={handlePost}
            disabled={!isValid || loading}
            className={`py-4 rounded-xl ${
              !isValid || loading ? 'bg-gray-300' : 'bg-green-500'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Posting...' : 'Post to Swaps'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
