import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { getUserPosts } from '../../services/postsService';
import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
} from '../../services/followsService';
import { User } from '../../models/User';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import PostCard from '../../components/PostCard';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Props {
  navigation: any;
}

export default function OtherUserProfileScreen({ navigation }: Props) {
  const route = useRoute();
  const { userId } = route.params as { userId: string };
  const session = useAuthStore((state) => state.session);

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [userId])
  );

  const loadData = async () => {
    try {
      const [userData, postsData] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        getUserPosts(userId),
      ]);

      if (userData.error) throw userData.error;
      setUser(userData.data);
      setPosts(postsData);

      if (session?.user.id) {
        const [followStatus, followers, followingCnt] = await Promise.all([
          isFollowing(session.user.id, userId),
          getFollowerCount(userId),
          getFollowingCount(userId),
        ]);
        setFollowing(followStatus);
        setFollowerCount(followers);
        setFollowingCount(followingCnt);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleFollowToggle = async () => {
    if (!session?.user.id) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(session.user.id, userId);
        setFollowing(false);
        setFollowerCount((c) => c - 1);
      } else {
        await followUser(session.user.id, userId);
        setFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    } catch (error) {
      console.error('Follow toggle error:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading || !user) {
    return <LoadingSpinner fullScreen />;
  }

  const renderHeader = () => (
    <View>
      {/* Profile Header */}
      <View className="items-center pt-6 pb-4 px-6">
        <Avatar avatarUrl={user.avatar_url} username={user.username} size={100} />
        <Text className="text-2xl font-bold mt-4">@{user.username}</Text>
        {user.city && <Text className="text-gray-500 mt-1">{user.city}</Text>}
        {user.bio && (
          <Text className="text-gray-700 text-center mt-3 px-4">{user.bio}</Text>
        )}

        {/* Follow button */}
        <TouchableOpacity
          onPress={handleFollowToggle}
          disabled={followLoading}
          style={{
            marginTop: 16,
            paddingHorizontal: 32,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: following ? '#fff' : '#38B6FF',
            borderWidth: 1,
            borderColor: following ? '#d1d5db' : '#38B6FF',
          }}
        >
          {followLoading ? (
            <ActivityIndicator color={following ? '#6b7280' : '#fff'} size="small" />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: '600', color: following ? '#374151' : '#fff' }}>
              {following ? 'Following' : 'Follow'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View className="flex-row justify-around py-4 border-y border-gray-200 mx-6">
        <View className="items-center">
          <Text className="text-2xl font-bold">{followerCount}</Text>
          <Text className="text-gray-500">Followers</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold">{followingCount}</Text>
          <Text className="text-gray-500">Following</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold">{user.total_swaps}</Text>
          <Text className="text-gray-500">Swaps</Text>
        </View>
        <View className="items-center">
          <Text className="text-2xl font-bold">
            {user.avg_rating?.toFixed(1) || '0.0'}
          </Text>
          <Text className="text-gray-500">Rating</Text>
        </View>
      </View>

      {/* Posts Header */}
      <View className="px-6 pt-4 pb-2">
        <Text className="font-semibold text-lg">Posts</Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center py-12">
      <Text className="text-gray-500">No posts yet</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-primary text-base">← Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center font-semibold text-lg">
          @{user.username}
        </Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
