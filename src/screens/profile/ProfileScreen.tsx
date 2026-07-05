import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { getUserPosts, deletePost, updatePostAvailability } from '../../services/postsService';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOOK_WIDTH = (SCREEN_WIDTH - 48) / 3; // 3 columns with padding
const BOOK_HEIGHT = BOOK_WIDTH * 1.5;

interface Props {
  navigation: any;
}

export default function ProfileScreen({ navigation }: Props) {
  const { profile, reset } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'swaps'>('posts');
  useFocusEffect(
    useCallback(() => {
      if (profile) {
        loadPosts();
      }
    }, [profile?.id])
  );

  const loadPosts = async () => {
    if (!profile) return;
    try {
      const data = await getUserPosts(profile.id);
      setPosts(data);
    } catch (error) {
      console.error('Error loading posts:', error);
    }
  };

  // Filter posts based on active tab
  const socialPosts = posts.filter((p) => p.post_type === 'social');
  const swapPosts = posts.filter((p) => p.post_type === 'swap');
  const filteredPosts = activeTab === 'posts' ? socialPosts : swapPosts;

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          reset();
        },
      },
    ]);
  };

  // DEV ONLY: Reset user to test onboarding again
  const handleDevReset = async () => {
    if (!profile) return;

    Alert.alert(
      'DEV: Reset Account',
      'This will delete your profile, posts, and sign you out. Sign back in to test onboarding from the beginning.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all posts for this user
              await supabase.from('posts').delete().eq('user_id', profile.id);
              // Delete user profile
              await supabase.from('users').delete().eq('id', profile.id);
              // Sign out
              await supabase.auth.signOut();
              reset();
            } catch (error) {
              console.error('Dev reset error:', error);
              Alert.alert('Error', 'Failed to reset. Check console.');
            }
          },
        },
      ]
    );
  };

  if (!profile) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Profile Header */}
      <View className="items-center pt-6 pb-4">
        <Avatar avatarUrl={profile.avatar_url} username={profile.username} size={100} />
        <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 16 }}>@{profile.username}</Text>
        <Text style={{ fontSize: 15, color: '#6b7280', marginTop: 4 }}>{profile.email}</Text>
        {profile.city && <Text style={{ fontSize: 15, color: '#6b7280' }}>{profile.city}</Text>}
        {profile.bio && (
          <Text style={{ fontSize: 15, color: '#374151', textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>
            {profile.bio}
          </Text>
        )}

        {/* Edit Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('EditProfile')}
          className="mt-4 border border-gray-300 px-6 py-2.5 rounded-full"
        >
          <Text style={{ fontSize: 15, fontWeight: '500', color: '#374151' }}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View className="flex-row justify-around py-3 border-b border-gray-100 mx-6">
        <View className="items-center">
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#10b981' }}>{profile.total_swaps || 0}</Text>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Swaps</Text>
        </View>
        <View className="items-center">
          <Text style={{ fontSize: 18, fontWeight: '700' }}>{profile.avg_rating?.toFixed(1) || '0.0'}</Text>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>Rating</Text>
        </View>
      </View>

      {/* Post type tabs */}
      <View className="flex-row border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setActiveTab('posts')}
          className={`flex-1 py-3 items-center ${activeTab === 'posts' ? 'border-b-2 border-black' : ''}`}
        >
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{socialPosts.length}</Text>
          <Text style={{ fontSize: 14, color: activeTab === 'posts' ? '#000' : '#6b7280' }}>Posts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('swaps')}
          className={`flex-1 py-3 items-center ${activeTab === 'swaps' ? 'border-b-2 border-black' : ''}`}
        >
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{swapPosts.length}</Text>
          <Text style={{ fontSize: 14, color: activeTab === 'swaps' ? '#000' : '#6b7280' }}>Listed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center py-12 px-6">
      <Text className="text-5xl mb-4">📚</Text>
      <Text style={{ fontSize: 17, color: '#6b7280', marginBottom: 8 }}>
        {activeTab === 'posts' ? 'No posts yet' : 'No swaps yet'}
      </Text>
      <Text style={{ fontSize: 15, color: '#9ca3af', textAlign: 'center' }}>
        {activeTab === 'posts'
          ? 'Share what you\'re reading!'
          : 'Post a book for swap!'}
      </Text>
    </View>
  );

  const handlePostLongPress = (item: Post) => {
    const isSwap = item.post_type === 'swap';
    const isAvailable = item.availability === 'available';

    const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'Cancel', style: 'cancel' },
    ];

    if (isSwap && isAvailable) {
      options.push({
        text: 'Mark as No Longer Available',
        onPress: () => {
          Alert.alert(
            'Mark as Unavailable',
            `Remove "${item.title}" from available swaps?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Mark Unavailable',
                onPress: async () => {
                  try {
                    await updatePostAvailability(item.id, 'swapped');
                    loadPosts();
                  } catch {
                    Alert.alert('Error', 'Could not update listing.');
                  }
                },
              },
            ]
          );
        },
      });
    }

    options.push({
      text: 'Delete Post',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Delete Post',
          `Permanently delete "${item.title}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  await deletePost(item.id);
                  loadPosts();
                } catch {
                  Alert.alert('Error', 'Could not delete post.');
                }
              },
            },
          ]
        );
      },
    });

    Alert.alert(item.title, 'What would you like to do?', options);
  };

  const renderShelf = () => (
    <View style={{
      height: 14,
      marginHorizontal: 8,
      backgroundColor: '#8B6914',
      borderRadius: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    }}>
      <View style={{
        height: 4,
        backgroundColor: '#A67C00',
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
      }} />
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        backgroundColor: '#6B5200',
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
      }} />
    </View>
  );

  const renderBookRow = (row: Post[], rowIndex: number) => (
    <View key={rowIndex}>
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, justifyContent: 'flex-start' }}>
        {row.map((item) => {
          const handlePress = () => {
            if (item.post_type === 'swap') {
              navigation.navigate('BookDetail', { postId: item.id });
            } else {
              navigation.navigate('PostDetail', { postId: item.id });
            }
          };

          return (
            <TouchableOpacity
              key={item.id}
              onPress={handlePress}
              onLongPress={() => handlePostLongPress(item)}
              delayLongPress={400}
              style={{ width: BOOK_WIDTH, height: BOOK_HEIGHT, marginHorizontal: 4 }}
            >
              {item.post_type === 'swap' && item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: '100%', height: '100%', borderRadius: 4 }}
                  contentFit="cover"
                />
              ) : (
                <BookCover
                  coverUrl={item.cover_image_url}
                  width={BOOK_WIDTH}
                  height={BOOK_HEIGHT}
                  style={{ borderRadius: 4 }}
                />
              )}
              {item.post_type === 'swap' && item.availability !== 'available' && (
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  borderRadius: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                    {item.availability === 'pending' ? 'PENDING' : 'SWAPPED'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {renderShelf()}
    </View>
  );

  const getRows = (data: Post[]) => {
    const rows: Post[][] = [];
    for (let i = 0; i < data.length; i += 3) {
      rows.push(data.slice(i, i + 3));
    }
    return rows;
  };

  const renderBooks = () => {
    const rows = getRows(filteredPosts);
    return <View>{rows.map((row, i) => renderBookRow(row, i))}</View>;
  };

  const renderFooter = () => (
    <View className="px-6 py-6 mt-4">
      <TouchableOpacity
        onPress={handleSignOut}
        className="border border-red-500 py-4 rounded-xl"
      >
        <Text className="text-red-500 text-center font-semibold text-lg">
          Sign Out
        </Text>
      </TouchableOpacity>

      {/* DEV ONLY: Reset button for testing */}
      {__DEV__ && (
        <TouchableOpacity
          onPress={handleDevReset}
          className="mt-4 bg-orange-500 py-4 rounded-xl"
        >
          <Text className="text-white text-center font-semibold text-lg">
            DEV: Reset & Test Onboarding
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
        <Text className="text-xl font-bold">Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('EditProfile')}>
          <Text className="text-primary">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {renderHeader()}
        {filteredPosts.length === 0 ? renderEmpty() : renderBooks()}
        {renderFooter()}
      </ScrollView>
    </SafeAreaView>
  );
}
