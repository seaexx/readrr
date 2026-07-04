import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { getUserPosts } from '../../services/postsService';
import { User } from '../../models/User';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import PostCard from '../../components/PostCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ReportModal from '../../components/ReportModal';
import { blockUser, unblockUser, isBlocked } from '../../services/blockService';
import { reportUser } from '../../services/reportService';

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
  const [blocked, setBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

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
        const blockStatus = await isBlocked(session.user.id, userId);
        setBlocked(blockStatus);
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

  const handleMenuPress = () => {
    const options = [
      blocked ? 'Unblock User' : 'Block User',
      'Report User',
      'Cancel',
    ];
    Alert.alert(undefined as any, undefined as any, [
      {
        text: options[0],
        style: 'destructive',
        onPress: () => {
          if (blocked) {
            handleUnblock();
          } else {
            handleBlock();
          }
        },
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

      </View>

      {/* Stats */}
      <View className="flex-row justify-around py-4 border-y border-gray-200 mx-6">
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
        <TouchableOpacity onPress={handleMenuPress} style={{ width: 50, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, color: '#6b7280' }}>•••</Text>
        </TouchableOpacity>
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
      <ReportModal
        visible={showReportModal}
        label="User"
        onSubmit={handleReport}
        onCancel={() => setShowReportModal(false)}
      />
    </SafeAreaView>
  );
}
