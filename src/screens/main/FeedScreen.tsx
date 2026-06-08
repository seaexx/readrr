import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { supabase } from '../../config/supabase';
import { getSocialPosts, getSwapPosts } from '../../services/postsService';
import { likePost, unlikePost } from '../../services/engagementService';
import { getUnreadCount } from '../../services/notificationsService';
import { useAuthStore } from '../../store/authStore';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';
import { HeartIcon, ChatBubbleLeftIcon, BellIcon } from 'react-native-heroicons/outline';
import { HeartIcon as HeartIconSolid, BellIcon as BellIconSolid } from 'react-native-heroicons/solid';

interface Props {
  navigation: any;
}

type TabType = 'feed' | 'swaps';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 16;
const GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;
const COVER_HEIGHT = Math.round(CARD_WIDTH * 1.5); // 2:3 aspect ratio for book covers

// Dynamic font size based on title length
const getTitleFontSize = (title: string) => {
  if (title.length > 40) return 12;
  if (title.length > 25) return 13;
  return 15;
};

interface PostWithEngagement extends Post {
  likeCount: number;
  commentCount: number;
  hasLiked: boolean;
}

export default function FeedScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [posts, setPosts] = useState<PostWithEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
      if (session?.user.id) {
        getUnreadCount(session.user.id).then(setUnreadNotifications).catch(() => {});
      }
    }, [activeTab, session?.user.id])
  );

  const getLikeCount = async (postId: string) => {
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    return count || 0;
  };

  const getCommentCount = async (postId: string) => {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    return count || 0;
  };

  const checkIfLiked = async (postId: string) => {
    if (!session) return false;
    const { data } = await supabase
      .from('likes')
      .select('id')
      .match({ post_id: postId, user_id: session.user.id })
      .maybeSingle();
    return !!data;
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const data =
        activeTab === 'feed' ? await getSocialPosts() : await getSwapPosts();

      // Load engagement counts for each post
      const postsWithCounts = await Promise.all(
        (data || []).map(async (post) => {
          const [likeCount, commentCount, hasLiked] = await Promise.all([
            getLikeCount(post.id),
            getCommentCount(post.id),
            checkIfLiked(post.id),
          ]);

          return {
            ...post,
            likeCount,
            commentCount,
            hasLiked,
          };
        })
      );

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data =
        activeTab === 'feed' ? await getSocialPosts() : await getSwapPosts();

      const postsWithCounts = await Promise.all(
        (data || []).map(async (post) => {
          const [likeCount, commentCount, hasLiked] = await Promise.all([
            getLikeCount(post.id),
            getCommentCount(post.id),
            checkIfLiked(post.id),
          ]);

          return {
            ...post,
            likeCount,
            commentCount,
            hasLiked,
          };
        })
      );

      setPosts(postsWithCounts);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || posts.length < 20) return;

    setLoadingMore(true);
    try {
      const data =
        activeTab === 'feed'
          ? await getSocialPosts(20, posts.length)
          : await getSwapPosts(20, posts.length);

      const postsWithCounts = await Promise.all(
        (data || []).map(async (post) => {
          const [likeCount, commentCount, hasLiked] = await Promise.all([
            getLikeCount(post.id),
            getCommentCount(post.id),
            checkIfLiked(post.id),
          ]);

          return {
            ...post,
            likeCount,
            commentCount,
            hasLiked,
          };
        })
      );

      setPosts((prev) => [...prev, ...postsWithCounts]);
    } catch (error) {
      console.error('Error loading more:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setPosts([]);
    }
  };

  const handleCardPress = (post: PostWithEngagement) => {
    if (post.post_type === 'swap') {
      navigation.navigate('BookDetail', { postId: post.id });
    } else {
      navigation.navigate('PostDetail', { postId: post.id });
    }
  };

  const handleLike = async (post: PostWithEngagement) => {
    if (!session) return;

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === post.id) {
          return {
            ...p,
            hasLiked: !p.hasLiked,
            likeCount: p.hasLiked ? p.likeCount - 1 : p.likeCount + 1,
          };
        }
        return p;
      })
    );

    try {
      if (post.hasLiked) {
        await unlikePost(post.id, session.user.id);
      } else {
        await likePost(post.id, session.user.id);
      }
    } catch (error) {
      // Revert on error
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === post.id) {
            return {
              ...p,
              hasLiked: post.hasLiked,
              likeCount: post.likeCount,
            };
          }
          return p;
        })
      );
    }
  };

  const renderBookCard = ({ item: post }: { item: PostWithEngagement }) => {
    // For swap posts, show user's uploaded photo
    // For social posts, show book cover from Google Books API
    let imageUrl: string | null = null;
    if (post.post_type === 'swap') {
      imageUrl = post.image_url || post.cover_image_url || null;
    } else {
      imageUrl = post.cover_image_url || post.image_url || null;
    }

    return (
      <View
        style={{
          width: CARD_WIDTH,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          elevation: 3,
        }}
        className="mb-4"
      >
        {/* User Info on Top */}
        <View className="flex-row items-center mb-2">
          <Avatar
            avatarUrl={post.user?.avatar_url}
            username={post.user?.username || 'User'}
            size={30}
          />
          <Text style={{ fontSize: 13, fontWeight: '500', marginLeft: 8, flex: 1 }} numberOfLines={1}>
            @{post.user?.username}
          </Text>
        </View>

        {/* Book Cover - Tappable */}
        <TouchableOpacity
          onPress={() => handleCardPress(post)}
          activeOpacity={0.8}
          style={{
            width: CARD_WIDTH,
            height: COVER_HEIGHT,
            borderRadius: 8,
            marginBottom: 8,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 4,
            backgroundColor: '#f3f4f6',
            overflow: 'hidden',
          }}
        >
          {post.post_type === 'swap' && post.image_url ? (
            // Swap post with user photo - use regular Image
            <Image
              source={{ uri: post.image_url }}
              style={{ width: CARD_WIDTH, height: COVER_HEIGHT }}
              contentFit="cover"
            />
          ) : (
            // Social post or swap without photo - use BookCover with zoom fallback
            <BookCover
              coverUrl={post.cover_image_url}
              width={CARD_WIDTH}
              height={COVER_HEIGHT}
              style={{ borderRadius: 8 }}
            />
          )}
        </TouchableOpacity>

        {/* Book Title - Dynamic font size */}
        <Text
          style={{ fontSize: getTitleFontSize(post.title), fontWeight: '600', marginBottom: 2, textAlign: 'center' }}
          numberOfLines={2}
        >
          {post.title}
        </Text>

        {/* Author */}
        {post.author && (
          <Text style={{ fontSize: 13, color: '#4b5563', marginBottom: 6, textAlign: 'center' }} numberOfLines={1}>
            {post.author}
          </Text>
        )}

        {/* Engagement Buttons - Only for social posts */}
        {post.post_type === 'social' && (
          <View className="flex-row items-center justify-center mt-1">
            {/* Like Button */}
            <TouchableOpacity
              onPress={() => handleLike(post)}
              className="flex-row items-center px-3 py-1"
              activeOpacity={0.7}
            >
              {post.hasLiked ? (
                <HeartIconSolid size={20} color="#E54B4B" style={{ marginRight: 4 }} />
              ) : (
                <HeartIcon size={20} color="#0072DD" style={{ marginRight: 4 }} />
              )}
              <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
                {post.likeCount}
              </Text>
            </TouchableOpacity>

            {/* Spacer */}
            <View className="w-4" />

            {/* Comment Button */}
            <TouchableOpacity
              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
              className="flex-row items-center px-3 py-1"
              activeOpacity={0.7}
            >
              <ChatBubbleLeftIcon size={20} color="#0072DD" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>
                {post.commentCount}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Swap type badge for swap posts */}
        {post.post_type === 'swap' && post.swap_type && (
          <View className="items-center mt-1">
            <View className="bg-blue-100 px-3 py-1.5 rounded-full">
              <Text style={{ fontSize: 13, color: '#1d4ed8' }} className="capitalize">{post.swap_type}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Text style={{ fontSize: 50, marginBottom: 16 }}>{activeTab === 'feed' ? '📚' : '🔄'}</Text>
      <Text style={{ fontSize: 18, color: '#6b7280', marginBottom: 8 }}>
        {activeTab === 'feed' ? 'No posts yet' : 'No swaps available'}
      </Text>
      <Text style={{ fontSize: 15, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 }}>
        {activeTab === 'feed'
          ? "Be the first to share what you're reading!"
          : 'Post a book to start swapping!'}
      </Text>
    </View>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#38B6FF" />
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Image
          source={require('../../../assets/images/logo.png')}
          style={{ width: 100, height: 50 }}
          contentFit="contain"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Bell icon */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={{ position: 'relative', padding: 4 }}
          >
            {unreadNotifications > 0 ? (
              <BellIconSolid size={26} color="#38B6FF" />
            ) : (
              <BellIcon size={26} color="#6b7280" />
            )}
            {unreadNotifications > 0 && (
              <View style={{
                position: 'absolute', top: 0, right: 0,
                backgroundColor: '#ef4444', borderRadius: 8,
                minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePost')}
            className="bg-primary px-4 py-2.5 rounded-full"
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>+ Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-200">
        <TouchableOpacity
          onPress={() => handleTabChange('feed')}
          className={`flex-1 py-3 ${
            activeTab === 'feed' ? 'border-b-2 border-primary' : ''
          }`}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
              color: activeTab === 'feed' ? '#38B6FF' : '#6b7280',
            }}
          >
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleTabChange('swaps')}
          className={`flex-1 py-3 ${
            activeTab === 'swaps' ? 'border-b-2 border-primary' : ''
          }`}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
              color: activeTab === 'swaps' ? '#38B6FF' : '#6b7280',
            }}
          >
            Swaps
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#38B6FF" />
        </View>
      ) : (
        <FlatList
          key={activeTab}
          data={posts}
          renderItem={renderBookCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{
            justifyContent: 'space-between',
            paddingHorizontal: PADDING,
            gap: GAP,
          }}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 100,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
