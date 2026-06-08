import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { searchBooks, BookInfo } from '../../services/booksService';
import { User } from '../../models/User';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';

type SearchTab = 'users' | 'books' | 'posts';

interface Props {
  navigation: any;
}

export default function SearchScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [loading, setLoading] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const search = useCallback(async (text: string, tab: SearchTab) => {
    if (!text.trim()) {
      setUsers([]);
      setBooks([]);
      setPosts([]);
      return;
    }

    setLoading(true);
    try {
      if (tab === 'users') {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .ilike('username', `%${text}%`)
          .limit(20);
        if (error) throw error;
        setUsers(data || []);
      } else if (tab === 'books') {
        const results = await searchBooks(text);
        setBooks(results);
      } else {
        const { data, error } = await supabase
          .from('posts')
          .select('*, user:users(id, username, avatar_url)')
          .or(`title.ilike.%${text}%,author.ilike.%${text}%`)
          .order('created_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    search(text, activeTab);
  };

  const handleTabChange = (tab: SearchTab) => {
    setActiveTab(tab);
    search(query, tab);
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('OtherUserProfile', { userId: item.id })}
      className="flex-row items-center px-4 py-3 border-b border-gray-100"
    >
      <Avatar avatarUrl={item.avatar_url} username={item.username} size={44} />
      <View className="ml-3 flex-1">
        <Text style={{ fontSize: 15, fontWeight: '600' }}>@{item.username}</Text>
        {item.city && (
          <Text style={{ fontSize: 13, color: '#6b7280' }}>{item.city}</Text>
        )}
      </View>
      <View className="items-end">
        <Text style={{ fontSize: 13, color: '#6b7280' }}>{item.total_swaps} swaps</Text>
        <Text style={{ fontSize: 13, color: '#f59e0b' }}>★ {item.avg_rating?.toFixed(1) || '0.0'}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderBookItem = ({ item }: { item: BookInfo }) => (
    <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
      <BookCover coverUrl={item.cover_image_url} width={44} height={64} style={{ borderRadius: 4 }} />
      <View className="ml-3 flex-1">
        <Text style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: '#6b7280' }} numberOfLines={1}>{item.author}</Text>
        {item.publishedDate && (
          <Text style={{ fontSize: 12, color: '#9ca3af' }}>{item.publishedDate.slice(0, 4)}</Text>
        )}
      </View>
    </View>
  );

  const renderPostItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate(item.post_type === 'swap' ? 'BookDetail' : 'PostDetail', {
          postId: item.id,
        })
      }
      className="flex-row items-center px-4 py-3 border-b border-gray-100"
    >
      <BookCover coverUrl={item.cover_image_url} width={44} height={64} style={{ borderRadius: 4 }} />
      <View className="ml-3 flex-1">
        <Text style={{ fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
        {item.author && (
          <Text style={{ fontSize: 13, color: '#6b7280' }}>{item.author}</Text>
        )}
        <View className="flex-row items-center mt-1">
          <Avatar
            avatarUrl={(item as any).user?.avatar_url}
            username={(item as any).user?.username || ''}
            size={16}
          />
          <Text style={{ fontSize: 12, color: '#9ca3af', marginLeft: 4 }}>
            @{(item as any).user?.username}
          </Text>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginLeft: 6 }}>
            · {item.post_type === 'swap' ? 'Swap' : 'Post'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const tabs: { key: SearchTab; label: string }[] = [
    { key: 'users', label: 'People' },
    { key: 'books', label: 'Books' },
    { key: 'posts', label: 'Posts' },
  ];

  const currentData = activeTab === 'users' ? users : activeTab === 'books' ? books : posts;
  const isEmpty = !loading && query.trim() && currentData.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Search bar */}
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2.5">
          <Text style={{ fontSize: 16, color: '#9ca3af', marginRight: 8 }}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            placeholder={
              activeTab === 'users'
                ? 'Search readers...'
                : activeTab === 'books'
                ? 'Search books...'
                : 'Search posts...'
            }
            placeholderTextColor="#9ca3af"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 16, color: '#1f2937' }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Text style={{ fontSize: 16, color: '#9ca3af' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200 px-4">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => handleTabChange(tab.key)}
            className={`mr-6 py-3 ${activeTab === tab.key ? 'border-b-2 border-black' : ''}`}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: activeTab === tab.key ? '600' : '400',
                color: activeTab === tab.key ? '#000' : '#6b7280',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#38B6FF" />
        </View>
      ) : !query.trim() ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
            {activeTab === 'users'
              ? 'Search for readers by username'
              : activeTab === 'books'
              ? 'Search for books by title or author'
              : 'Search posts by book title or author'}
          </Text>
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
          <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
            No results for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={currentData as any[]}
          keyExtractor={(item) => item.id || item.isbn || item.title}
          renderItem={
            activeTab === 'users'
              ? renderUserItem
              : activeTab === 'books'
              ? renderBookItem
              : renderPostItem
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}
