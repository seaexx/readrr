import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { CaretLeft, DotsThree, Books, WarningCircle, Prohibit } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';
import { useAuthStore } from '../../store/authStore';
import { getUserPosts } from '../../services/postsService';
import { User } from '../../models/User';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import BookGrid from '../../components/BookGrid';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReportModal from '../../components/ReportModal';
import { blockUser, unblockUser, isBlocked } from '../../services/blockService';
import { reportUser } from '../../services/reportService';
import { getCached, setCached, seedPostCache, getUserPreview } from '../../utils/memoryCache';

interface Props {
  navigation: any;
}

interface CachedProfile {
  user: User;
  posts: Post[];
  blocked: boolean;
}

export default function OtherUserProfileScreen({ navigation }: Props) {
  const route = useRoute();
  const { userId } = route.params as { userId: string };
  const session = useAuthStore((state) => state.session);

  // Seed from the in-memory cache so reopening a profile renders instantly.
  const cacheKey = `otherProfile:${userId}`;
  const cached = getCached<CachedProfile>(cacheKey);
  const [user, setUser] = useState<User | null>(cached?.user ?? null);
  // Name + avatar from whatever list we came from, so the header renders
  // immediately instead of popping in after the fetch.
  const preview = getUserPreview(userId);
  const [posts, setPosts] = useState<Post[]>(cached?.posts ?? []);
  const [blocked, setBlocked] = useState(cached?.blocked ?? false);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'swaps'>('posts');
  const [showReportModal, setShowReportModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [userId])
  );

  const loadData = async () => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;

      // Mutual blocks hide this user's posts
      let blockStatus = false;
      if (session?.user.id) {
        blockStatus = await isBlocked(session.user.id, userId);
      }
      const userPosts = blockStatus ? [] : await getUserPosts(userId, 60);

      seedPostCache(userPosts);
      setUser(userData);
      setBlocked(blockStatus);
      setPosts(userPosts);
      setCached<CachedProfile>(cacheKey, { user: userData, posts: userPosts, blocked: blockStatus });
      setError(null);
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err?.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMenuPress = () => {
    Alert.alert(undefined as any, undefined as any, [
      {
        text: blocked ? 'Unblock User' : 'Block User',
        style: 'destructive',
        onPress: () => (blocked ? handleUnblock() : handleBlock()),
      },
      { text: 'Report User', onPress: () => setShowReportModal(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${user?.username}? You won't see each other's posts or be able to swap.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!session?.user.id) return;
            try {
              await blockUser(session.user.id, userId);
              setBlocked(true);
              navigation.goBack();
            } catch (error) {
              console.error('Block error:', error);
              Alert.alert('Error', 'Failed to block user.');
            }
          },
        },
      ]
    );
  };

  const handleUnblock = async () => {
    if (!session?.user.id) return;
    try {
      await unblockUser(session.user.id, userId);
      setBlocked(false);
      await loadData();
    } catch (error) {
      console.error('Unblock error:', error);
      Alert.alert('Error', 'Failed to unblock user.');
    }
  };

  const handleReport = async (reason: string, details: string) => {
    if (!session?.user.id) return;
    await reportUser(session.user.id, userId, reason, details);
    setShowReportModal(false);
    Alert.alert('Report Submitted', 'Thank you. We will review this report.');
  };

  const handlePostPress = (item: Post) => {
    if (item.post_type === 'swap') {
      navigation.navigate('BookDetail', { postId: item.id });
    } else {
      navigation.navigate('PostDetail', { postId: item.id });
    }
  };

  const topBar = (
    <View className="flex-row items-center px-2 py-2">
      <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }} hitSlop={8}>
        <CaretLeft size={24} color="#1a1a1a" />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      {user && (
        <TouchableOpacity onPress={handleMenuPress} style={{ padding: 8 }} hitSlop={8}>
          <DotsThree size={24} color="#1a1a1a" weight="bold" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (!user && !preview) {
    if (error && !loading) {
      return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
          {topBar}
          <View className="flex-1 items-center justify-center px-8">
            <WarningCircle size={48} color="#ef4444" weight="duotone" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center', marginBottom: 4 }}>Couldn't load profile</Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 16 }}>{error}</Text>
            <TouchableOpacity onPress={loadData} className="bg-primary px-6 py-3 rounded-xl">
              <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return <LoadingSpinner fullScreen />;
  }

  const header = {
    username: user?.username ?? preview?.username ?? '',
    avatar_url: user?.avatar_url ?? preview?.avatar_url ?? null,
    city: user?.city ?? preview?.city ?? null,
    bio: user?.bio ?? null,
  };

  const socialPosts = posts.filter((p) => p.post_type === 'social');
  const swapPosts = posts.filter((p) => p.post_type === 'swap');
  const filteredPosts = activeTab === 'posts' ? socialPosts : swapPosts;

  const renderHeader = () => (
    <View>
      {/* Profile hero */}
      <View className="items-center px-6 pt-2 pb-5">
        <Avatar avatarUrl={header.avatar_url} username={header.username || 'User'} size={96} />
        <Text style={{ fontSize: 24, fontFamily: fonts.serifSemiBold, color: '#1a1a1a', marginTop: 14 }}>@{header.username}</Text>
        {header.city && (
          <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>{header.city}</Text>
        )}
        {header.bio && (
          <Text style={{ fontSize: 15, color: '#4b5563', textAlign: 'center', marginTop: 12, lineHeight: 21 }}>
            {header.bio}
          </Text>
        )}
      </View>

      {/* Stats */}
      <View
        className="flex-row mx-6"
        style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 14 }}
      >
        <View className="flex-1 items-center">
          <Text style={{ fontSize: 22, fontFamily: fonts.serifSemiBold, color: '#1a1a1a' }}>{user ? user.total_swaps || 0 : '–'}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Swaps</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#f3f4f6' }} />
        <View className="flex-1 items-center">
          <Text style={{ fontSize: 22, fontFamily: fonts.serifSemiBold, color: '#1a1a1a' }}>{user ? user.avg_rating?.toFixed(1) || '0.0' : '–'}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Rating</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#f3f4f6' }} />
        <View className="flex-1 items-center">
          <Text style={{ fontSize: 22, fontFamily: fonts.serifSemiBold, color: '#1a1a1a' }}>{loading ? '–' : posts.length}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Books</Text>
        </View>
      </View>

      {/* Content tabs */}
      {!blocked && (
        <View className="flex-row mt-2">
          {(['posts', 'swaps'] as const).map((tab) => {
            const active = activeTab === tab;
            const label = tab === 'posts' ? `Posts (${socialPosts.length})` : `Listed (${swapPosts.length})`;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                className="flex-1 py-3 items-center"
                style={active ? { borderBottomWidth: 2, borderColor: '#38B6FF' } : undefined}
              >
                <Text style={{ fontSize: 16, fontFamily: fonts.serifSemiBold, color: active ? '#38B6FF' : '#9ca3af' }}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );

  const renderBody = () => {
    if (error && !user) {
      return (
        <View className="items-center py-12 px-8">
          <WarningCircle size={40} color="#ef4444" weight="duotone" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center', marginBottom: 12 }}>Couldn't load profile</Text>
          <TouchableOpacity onPress={loadData} className="bg-primary px-6 py-3 rounded-xl">
            <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (blocked) {
      return (
        <View className="items-center py-12 px-6">
          <Prohibit size={44} color="#9ca3af" weight="duotone" style={{ marginBottom: 12 }} />
          <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center' }}>
            You've blocked this reader. Unblock from the ••• menu to see their books.
          </Text>
        </View>
      );
    }
    if (loading) {
      return (
        <View className="items-center py-12">
          <ActivityIndicator color="#38B6FF" />
        </View>
      );
    }
    if (filteredPosts.length === 0) {
      return (
        <View className="items-center py-12 px-6">
          <Books size={48} color="#9ca3af" weight="duotone" style={{ marginBottom: 16 }} />
          <Text style={{ fontSize: 17, color: '#6b7280' }}>
            {activeTab === 'posts' ? 'No posts yet' : 'Nothing listed for swap'}
          </Text>
        </View>
      );
    }
    return <BookGrid posts={filteredPosts} onPress={handlePostPress} />;
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {topBar}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {renderHeader()}
        {renderBody()}
      </ScrollView>
      <ReportModal
        visible={showReportModal}
        label="User"
        onSubmit={handleReport}
        onCancel={() => setShowReportModal(false)}
      />
    </SafeAreaView>
  );
}
