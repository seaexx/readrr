import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { getBlockedUserIds } from '../../services/blockService';
import { Post } from '../../models/Post';
import { MagnifyingGlass, Tray, X, WarningCircle } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';
import { useThemeColors } from '../../theme/colors';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';

interface Props {
  navigation: any;
}

export default function SearchScreen({ navigation }: Props) {
  const ink = useThemeColors();
  const session = useAuthStore((state) => state.session);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (text: string) => {
    if (!text.trim()) {
      setPosts([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let dbQuery = supabase
        .from('posts')
        .select('*, user:users(id, username, avatar_url)')
        .or(`title.ilike.%${text}%,author.ilike.%${text}%`);

      if (session?.user.id) {
        const blockedUserIds = await getBlockedUserIds(session.user.id);
        if (blockedUserIds.length > 0) {
          dbQuery = dbQuery.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
        }
      }

      const { data, error } = await dbQuery
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Search error:', error);
      setError(error?.message || 'Search failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    search(text);
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate(item.post_type === 'swap' ? 'BookDetail' : 'PostDetail', {
          postId: item.id,
        })
      }
      className="flex-row items-center px-4 py-3 border-b border-gray-100 dark:border-gray-800"
    >
      <BookCover coverUrl={item.cover_image_url} width={44} height={64} style={{ borderRadius: 4 }} />
      <View className="ml-3 flex-1">
        <Text style={{ fontSize: 16, fontFamily: fonts.serifMedium, color: ink.heading }} numberOfLines={2}>{item.title}</Text>
        {item.author && (
          <Text style={{ fontSize: 13, color: ink.muted }}>{item.author}</Text>
        )}
        <View className="flex-row items-center mt-1">
          <Avatar
            avatarUrl={(item as any).user?.avatar_url}
            username={(item as any).user?.username || ''}
            size={16}
          />
          <Text style={{ fontSize: 12, color: ink.subtle, marginLeft: 4 }}>
            @{(item as any).user?.username}
          </Text>
          <Text style={{ fontSize: 12, color: ink.subtle, marginLeft: 6 }}>
            · {item.post_type === 'swap' ? 'Swap' : 'Post'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const isEmpty = !loading && query.trim() && posts.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={['top']}>
      {/* Header */}
      <View className="px-4 pt-2 pb-1">
        <Text style={{ fontSize: 30, fontFamily: fonts.serifSemiBold, color: ink.heading }}>Search</Text>
      </View>

      {/* Search bar */}
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5">
          <MagnifyingGlass size={16} color={ink.subtle} weight="regular" style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder="Search posts by title or author..."
            placeholderTextColor={ink.subtle}
            autoCorrect={false}
            style={{ flex: 1, fontSize: 16, color: ink.strong }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <X size={16} color={ink.subtle} weight="regular" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38B6FF" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <WarningCircle size={40} color="#ef4444" weight="duotone" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: ink.body, fontWeight: '600', textAlign: 'center', marginBottom: 4 }}>
            Search failed
          </Text>
          <Text style={{ fontSize: 14, color: ink.muted, textAlign: 'center', marginBottom: 16 }}>{error}</Text>
          <TouchableOpacity onPress={() => search(query)} className="bg-primary px-6 py-3 rounded-xl">
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : !query.trim() ? (
        <View className="flex-1 items-center justify-center px-8">
          <MagnifyingGlass size={40} color={ink.subtle} weight="duotone" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: ink.muted, textAlign: 'center' }}>
            Search posts by book title or author
          </Text>
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-8">
          <Tray size={40} color={ink.subtle} weight="duotone" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: ink.muted, textAlign: 'center' }}>
            No results for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPostItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
