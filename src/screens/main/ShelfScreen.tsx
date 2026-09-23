import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/authStore';
import { getCached, setCached } from '../../utils/memoryCache';
import {
  ShelfItem,
  ShelfName,
  getShelf,
  moveShelfItem,
  removeShelfItem,
  saveToShelf,
  normalizeTitle,
} from '../../services/shelfService';
import { getSwapPosts } from '../../services/postsService';
import { getBlockedUserIds } from '../../services/blockService';
import { BookInfo } from '../../services/booksService';
import BookCover from '../../components/BookCover';
import BookFinder from '../../components/BookFinder';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Bookmark, Check, MapPin, Plus, WarningCircle } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';

interface Props {
  navigation: any;
}

const SHELVES: { key: ShelfName; label: string }[] = [
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'reading', label: 'Reading' },
  { key: 'finished', label: 'Finished' },
];

const OTHER_SHELVES: Record<ShelfName, { key: ShelfName; label: string }[]> = {
  want_to_read: [
    { key: 'reading', label: 'Move to Reading' },
    { key: 'finished', label: 'Move to Finished' },
  ],
  reading: [
    { key: 'want_to_read', label: 'Move to Want to Read' },
    { key: 'finished', label: 'Move to Finished' },
  ],
  finished: [
    { key: 'want_to_read', label: 'Move to Want to Read' },
    { key: 'reading', label: 'Move to Reading' },
  ],
};

export default function ShelfScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const [activeShelf, setActiveShelf] = useState<ShelfName>('want_to_read');
  const shelfKey = (shelf: ShelfName) => `shelf:${session?.user.id}:${shelf}`;
  const [items, setItems] = useState<ShelfItem[]>(() => getCached<ShelfItem[]>(shelfKey('want_to_read')) ?? []);
  const [loading, setLoading] = useState(() => getCached(shelfKey('want_to_read')) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findingBook, setFindingBook] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadShelf();
    }, [activeShelf, session?.user.id])
  );

  const loadShelf = async () => {
    if (!session?.user.id) return;
    const key = shelfKey(activeShelf);
    // Show the cached shelf instantly; only spin on a first-ever load.
    const cached = getCached<ShelfItem[]>(key);
    if (cached) {
      setItems(cached);
      setLoading(false);
    } else {
      setItems([]);
      setLoading(true);
    }
    setError(null);
    try {
      const data = await getShelf(session.user.id, activeShelf);
      // Show the books now; the nearby-availability flags fill in after.
      setItems(data);
      setCached(key, data);
      setLoading(false);

      // Slice 4: for Want to Read, flag items with an available nearby copy
      if (activeShelf === 'want_to_read' && data.length > 0) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc =
              (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
              (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
            const blocked = await getBlockedUserIds(session.user.id).catch(() => [] as string[]);
            const nearby = await getSwapPosts(100, 0, blocked, {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            const byTitle = new Map<string, number>();
            for (const p of nearby) {
              const key = normalizeTitle(p.title);
              const d = p.distance_miles ?? Number.POSITIVE_INFINITY;
              if (!byTitle.has(key) || d < (byTitle.get(key) as number)) byTitle.set(key, d);
            }
            data.forEach((item) => {
              const d = byTitle.get(normalizeTitle(item.title));
              if (d !== undefined && d !== Number.POSITIVE_INFINITY) {
                item.available_nearby = true;
                item.nearby_distance_miles = d;
              }
            });
          }
        } catch {
          // Availability flags are best-effort; shelf still loads
        }
      }

      setItems([...data]);
      setCached(key, data);
    } catch (err: any) {
      console.error('Error loading shelf:', err);
      setError(err?.message || 'Failed to load shelf.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadShelf();
  };

  const handleAddBook = async (book: BookInfo) => {
    if (!session?.user.id) return;
    setFindingBook(false);
    try {
      await saveToShelf(session.user.id, book, activeShelf);
      loadShelf();
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    }
  };

  const handleItemPress = (item: ShelfItem) => {
    Alert.alert(`"${item.title}"`, item.author || '', [
      ...OTHER_SHELVES[item.shelf].map((o) => ({
        text: o.label,
        onPress: async () => {
          try {
            await moveShelfItem(item.id, o.key);
            loadShelf();
          } catch {
            Alert.alert('Error', 'Could not move. Please try again.');
          }
        },
      })),
      {
        text: 'Remove from Shelf',
        style: 'destructive' as const,
        onPress: () => {
          Alert.alert('Remove?', `"${item.title}" will be removed from your shelf.`, [
            { text: 'Cancel', style: 'cancel' as const },
            {
              text: 'Remove',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await removeShelfItem(item.id);
                  loadShelf();
                } catch {
                  Alert.alert('Error', 'Could not remove. Please try again.');
                }
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const renderItem = ({ item }: { item: ShelfItem }) => (
    <TouchableOpacity
      onPress={() => handleItemPress(item)}
      className="flex-row items-center px-4 py-3 border-b border-gray-100"
    >
      <BookCover coverUrl={item.cover_image_url} width={44} height={64} style={{ borderRadius: 4 }} />
      <View className="ml-3 flex-1">
        <Text style={{ fontSize: 16, fontFamily: fonts.serifMedium, color: '#1a1a1a' }} numberOfLines={2}>{item.title}</Text>
        {item.author && (
          <Text style={{ fontSize: 13, color: '#6b7280' }} numberOfLines={1}>{item.author}</Text>
        )}
        {item.available_nearby && (
          <View className="flex-row items-center mt-1" style={{ gap: 4 }}>
            <Bookmark size={12} color="#15803d" weight="fill" />
            <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '600' }}>
              Available nearby
              {item.nearby_distance_miles != null && item.nearby_distance_miles !== Number.POSITIVE_INFINITY
                ? ` · ${item.nearby_distance_miles < 0.1 ? '<0.1' : item.nearby_distance_miles.toFixed(1)} mi`
                : ''}
            </Text>
          </View>
        )}
      </View>
      {item.shelf === 'finished' && (
        <Check size={16} color="#10b981" weight="bold" />
      )}
    </TouchableOpacity>
  );

  if (findingBook) {
    return (
      <BookFinder
        onSelect={handleAddBook}
        onCancel={() => setFindingBook(false)}
        title="Add to Shelf"
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <Text className="text-lg" style={{ fontFamily: fonts.serifSemiBold }}>My Shelf</Text>
        <TouchableOpacity onPress={() => setFindingBook(true)} style={{ padding: 4 }}>
          <Plus size={22} color="#38B6FF" weight="regular" />
        </TouchableOpacity>
      </View>

      <View className="flex-row border-b border-gray-200">
        {SHELVES.map((s) => (
          <TouchableOpacity
            key={s.key}
            onPress={() => setActiveShelf(s.key)}
            className={`flex-1 py-3 ${activeShelf === s.key ? 'border-b-2 border-primary' : ''}`}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: fonts.serifSemiBold,
                textAlign: 'center',
                color: activeShelf === s.key ? '#38B6FF' : '#6b7280',
              }}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <WarningCircle size={40} color="#ef4444" weight="duotone" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center', marginBottom: 4 }}>
            Couldn't load shelf
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={loadShelf} className="bg-primary px-6 py-3 rounded-xl">
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Bookmark size={48} color="#9ca3af" weight="duotone" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
            {activeShelf === 'want_to_read'
              ? 'Nothing saved yet'
              : activeShelf === 'reading'
              ? 'Not reading anything'
              : 'No finished books'}
          </Text>
          <Text style={{ fontSize: 15, color: '#9ca3af', textAlign: 'center', marginBottom: 16 }}>
            {activeShelf === 'want_to_read'
              ? 'Save books you want to read — we’ll flag copies available nearby.'
              : 'Tap + to add a book to this shelf.'}
          </Text>
          <TouchableOpacity onPress={() => setFindingBook(true)} className="bg-primary px-6 py-3 rounded-xl">
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add a Book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListFooterComponent={
            activeShelf === 'want_to_read' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 4 }}>
                <MapPin size={12} color="#9ca3af" weight="regular" />
                <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  Nearby availability needs location access
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
