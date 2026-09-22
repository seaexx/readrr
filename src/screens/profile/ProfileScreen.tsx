import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { Books, WarningCircle } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';
import { getUserPosts, deletePost, updatePostAvailability } from '../../services/postsService';
import { getPostSwapImpact } from '../../services/swapsService';
import { Post } from '../../models/Post';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - 32 - GRID_GAP) / 2; // 2 columns, 16px side padding
const CARD_H = Math.round(CARD_W * 1.5);

interface Props {
  navigation: any;
}

export default function ProfileScreen({ navigation }: Props) {
  const { profile, reset } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'swaps'>('posts');
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
    } catch (error: any) {
      console.error('Error loading posts:', error);
      setError(error?.message || 'Failed to load posts. Pull to retry.');
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

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Permanently delete your account and all your posts, swaps, and messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('delete_own_account');
              if (error) throw error;
              await supabase.auth.signOut();
              reset();
            } catch (error: any) {
              console.error('Delete account error:', error);
              Alert.alert('Error', error.message || 'Failed to delete account. Please try again or contact support.');
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
      {/* Profile hero */}
      <View className="items-center px-6 pt-2 pb-5">
        <Avatar avatarUrl={profile.avatar_url} username={profile.username} size={96} />
        <Text style={{ fontSize: 24, fontFamily: fonts.serifSemiBold, color: '#1a1a1a', marginTop: 14 }}>@{profile.username}</Text>
        {profile.city && (
          <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>{profile.city}</Text>
        )}
        {profile.bio && (
          <Text style={{ fontSize: 15, color: '#4b5563', textAlign: 'center', marginTop: 12, lineHeight: 21 }}>
            {profile.bio}
          </Text>
        )}

        {/* Actions */}
        <View className="flex-row mt-5" style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditProfile')}
            className="border border-gray-300 px-6 py-2.5 rounded-full"
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Shelf')}
            className="px-6 py-2.5 rounded-full"
            style={{ backgroundColor: '#38B6FF' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>My Shelf</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View
        className="flex-row mx-6"
        style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f3f4f6', paddingVertical: 14 }}
      >
        <View className="flex-1 items-center">
          <Text style={{ fontSize: 22, fontFamily: fonts.serifSemiBold, color: '#1a1a1a' }}>{profile.total_swaps || 0}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Swaps</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#f3f4f6' }} />
        <View className="flex-1 items-center">
          <Text style={{ fontSize: 22, fontFamily: fonts.serifSemiBold, color: '#1a1a1a' }}>{profile.avg_rating?.toFixed(1) || '0.0'}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Rating</Text>
        </View>
        <View style={{ width: 1, backgroundColor: '#f3f4f6' }} />
        <View className="flex-1 items-center">
          <Text style={{ fontSize: 22, fontFamily: fonts.serifSemiBold, color: '#1a1a1a' }}>{posts.length}</Text>
          <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>Books</Text>
        </View>
      </View>

      {/* Content tabs */}
      <View className="flex-row mt-2">
        <TouchableOpacity
          onPress={() => setActiveTab('posts')}
          className="flex-1 py-3 items-center"
          style={activeTab === 'posts' ? { borderBottomWidth: 2, borderColor: '#38B6FF' } : undefined}
        >
          <Text style={{ fontSize: 16, fontFamily: fonts.serifSemiBold, color: activeTab === 'posts' ? '#38B6FF' : '#9ca3af' }}>
            Posts ({socialPosts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('swaps')}
          className="flex-1 py-3 items-center"
          style={activeTab === 'swaps' ? { borderBottomWidth: 2, borderColor: '#38B6FF' } : undefined}
        >
          <Text style={{ fontSize: 16, fontFamily: fonts.serifSemiBold, color: activeTab === 'swaps' ? '#38B6FF' : '#9ca3af' }}>
            Listed ({swapPosts.length})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View className="items-center py-12 px-6">
      <Books size={48} color="#9ca3af" weight="duotone" style={{ marginBottom: 16 }} />
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
      onPress: async () => {
        const doDelete = async () => {
          try {
            await deletePost(item.id);
            loadPosts();
          } catch {
            Alert.alert('Error', 'Could not delete post.');
          }
        };

        // A swap listing may have swap requests + chat that a hard delete wipes
        // for both people. Check first and warn, offering to hide instead.
        let impact = { swapCount: 0, hasChat: false };
        if (isSwap) {
          try {
            impact = await getPostSwapImpact(item.id);
          } catch {}
        }

        if (impact.swapCount > 0) {
          Alert.alert(
            'Delete this listing?',
            `"${item.title}" has ${impact.swapCount} swap request${impact.swapCount > 1 ? 's' : ''}${
              impact.hasChat ? ' with chat history' : ''
            }. Deleting removes ${
              impact.hasChat ? 'the conversation for both of you' : 'those requests'
            } permanently. Hiding it keeps everything but takes it off the market.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Hide instead',
                onPress: async () => {
                  try {
                    await updatePostAvailability(item.id, 'swapped');
                    loadPosts();
                  } catch {
                    Alert.alert('Error', 'Could not update listing.');
                  }
                },
              },
              { text: 'Delete anyway', style: 'destructive', onPress: doDelete },
            ]
          );
        } else {
          Alert.alert('Delete Post', `Permanently delete "${item.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
          ]);
        }
      },
    });

    Alert.alert(item.title, 'What would you like to do?', options);
  };

  const renderBooks = () => (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingTop: 16,
        columnGap: GRID_GAP,
      }}
    >
      {filteredPosts.map((item) => {
        const handlePress = () => {
          if (item.post_type === 'swap') {
            navigation.navigate('BookDetail', { postId: item.id });
          } else {
            navigation.navigate('PostDetail', { postId: item.id });
          }
        };
        const unavailable = item.post_type === 'swap' && item.availability !== 'available';

        return (
          <TouchableOpacity
            key={item.id}
            onPress={handlePress}
            onLongPress={() => handlePostLongPress(item)}
            delayLongPress={400}
            activeOpacity={0.85}
            style={{ width: CARD_W, marginBottom: 18 }}
          >
            <View
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 8,
                backgroundColor: '#fff',
                shadowColor: '#1e293b',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.16,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
                {item.post_type === 'swap' && item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <BookCover coverUrl={item.cover_image_url} width={CARD_W} height={CARD_H} style={{ borderRadius: 8 }} />
                )}
                {unavailable && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {item.availability === 'pending' ? 'PENDING' : 'SWAPPED'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={{ fontSize: 13, fontFamily: fonts.serifMedium, color: '#1a1a1a', marginTop: 6 }} numberOfLines={1}>
              {item.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderFooter = () => (
    <View className="px-6 pt-8 pb-4">
      <TouchableOpacity
        onPress={handleSignOut}
        className="border border-gray-300 py-3.5 rounded-xl"
      >
        <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#374151' }}>
          Sign Out
        </Text>
      </TouchableOpacity>

      <View className="flex-row justify-center mt-6" style={{ gap: 20 }}>
        <Text
          style={{ fontSize: 13, color: '#9ca3af' }}
          onPress={() => Linking.openURL('https://readrr.app/terms')}
        >
          Terms
        </Text>
        <Text
          style={{ fontSize: 13, color: '#9ca3af' }}
          onPress={() => Linking.openURL('https://readrr.app/privacy')}
        >
          Privacy
        </Text>
        <Text
          style={{ fontSize: 13, color: '#ef4444' }}
          onPress={handleDeleteAccount}
        >
          Delete account
        </Text>
      </View>

      {/* DEV ONLY: Reset button for testing */}
      {__DEV__ && (
        <TouchableOpacity
          onPress={handleDevReset}
          className="mt-6 bg-orange-500 py-3 rounded-xl"
        >
          <Text className="text-white text-center font-semibold">
            DEV: Reset & Test Onboarding
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3">
        <Text style={{ fontSize: 30, fontFamily: fonts.serifSemiBold }}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {renderHeader()}
        {error ? (
          <View className="items-center py-12 px-6">
            <WarningCircle size={40} color="#ef4444" weight="duotone" style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, color: '#374151', fontWeight: '600', textAlign: 'center', marginBottom: 4 }}>
              Couldn't load posts
            </Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity onPress={loadPosts} className="bg-primary px-6 py-3 rounded-xl">
              <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredPosts.length === 0 ? renderEmpty() : renderBooks()}
        {renderFooter()}
      </ScrollView>
    </SafeAreaView>
  );
}
