import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRoute } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { Post } from '../../models/Post';
import { canRequestSwap, createSwapRequest, hasPendingRequest } from '../../services/swapsService';
import { isBlocked } from '../../services/blockService';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';
import LoadingSpinner from '../../components/LoadingSpinner';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_WIDTH = (SCREEN_WIDTH - 48) / 2; // Two images with padding and gap

interface Props {
  navigation: any;
}

export default function BookDetailScreen({ navigation }: Props) {
  const route = useRoute();
  const { postId } = route.params as { postId: string };
  const session = useAuthStore((state) => state.session);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [canSwap, setCanSwap] = useState(false);
  const [checkingSwap, setCheckingSwap] = useState(true);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapMessage, setSwapMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPost();
  }, [postId]);

  useEffect(() => {
    checkSwapEligibility();
  }, [post, session]);

  const checkSwapEligibility = async () => {
    if (!post || !session?.user.id) {
      setCheckingSwap(false);
      return;
    }

    // Skip check if it's own post or not available
    if (post.user_id === session.user.id || post.availability !== 'available') {
      setCanSwap(false);
      setCheckingSwap(false);
      return;
    }

    try {
      const blocked = await isBlocked(session.user.id, post.user_id);
      if (blocked) {
        setCanSwap(false);
        setCheckingSwap(false);
        return;
      }
      const eligible = await canRequestSwap(session.user.id, post.id);
      setCanSwap(eligible);
    } catch (error) {
      console.error('Error checking swap eligibility:', error);
      setCanSwap(false);
    } finally {
      setCheckingSwap(false);
    }
  };

  const loadPost = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, user:users(id, username, avatar_url, city)')
        .eq('id', postId)
        .single();

      if (error) throw error;
      setPost(data);
    } catch (error) {
      console.error('Error loading post:', error);
      Alert.alert('Error', 'Failed to load book details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = () => {
    if (!post?.user) return;

    if (post.user.id === session?.user.id) {
      navigation.navigate('MainTabs', { screen: 'Profile' });
    } else {
      navigation.navigate('OtherUserProfile', { userId: post.user.id });
    }
  };

  const handleRequestSwap = () => {
    setShowSwapModal(true);
  };

  const submitSwapRequest = async () => {
    if (!post || !session?.user.id) return;

    setSubmitting(true);
    try {
      await createSwapRequest(
        session.user.id,
        post.user_id,
        post.id,
        swapMessage.trim() || undefined
      );

      setShowSwapModal(false);
      setSwapMessage('');
      setCanSwap(false); // Can't request again

      Alert.alert(
        'Request Sent!',
        `Your swap request has been sent to @${post.user?.username}. You'll be notified when they respond.`,
        [
          {
            text: 'View Inbox',
            onPress: () => navigation.navigate('Inbox', { tab: 'sent' }),
          },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      console.error('Error creating swap request:', error);
      Alert.alert('Error', error.message || 'Failed to send swap request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !post) {
    return <LoadingSpinner fullScreen />;
  }

  const isOwnPost = post.user_id === session?.user.id;
  const hasUserPhoto = !!post.image_url;
  const hasCoverUrl = !!post.cover_image_url;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 16, color: '#38B6FF' }}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Images - show both cover and user photo side by side for swaps */}
        {hasUserPhoto && hasCoverUrl ? (
          // Both images: show side by side
          <View className="flex-row justify-center px-4 py-2" style={{ gap: 12 }}>
            {/* Book Cover */}
            <View>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Book Cover</Text>
              <BookCover
                coverUrl={post.cover_image_url}
                width={IMAGE_WIDTH}
                height={IMAGE_WIDTH * 1.4}
                style={{ borderRadius: 8 }}
              />
            </View>
            {/* User's Photo */}
            <View>
              <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>Actual Book</Text>
              <Image
                source={{ uri: post.image_url! }}
                style={{ width: IMAGE_WIDTH, height: IMAGE_WIDTH * 1.4, borderRadius: 8 }}
                contentFit="cover"
              />
            </View>
          </View>
        ) : hasUserPhoto ? (
          // Only user photo
          <Image
            source={{ uri: post.image_url! }}
            style={{ width: '100%', height: 350 }}
            contentFit="cover"
          />
        ) : (
          // Only cover or no image - use BookCover with fallback
          <BookCover
            coverUrl={post.cover_image_url}
            width={SCREEN_WIDTH}
            height={350}
          />
        )}

        {/* Book Info */}
        <View className="px-6 py-4">
          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4 }}>{post.title}</Text>
          {post.author && (
            <Text style={{ fontSize: 17, color: '#4b5563', marginBottom: 16 }}>{post.author}</Text>
          )}

          {/* Tags */}
          <View className="flex-row flex-wrap mb-4">
            {post.condition && (
              <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 mb-2">
                <Text style={{ fontSize: 15, color: '#374151' }} className="capitalize">
                  {post.condition.replace('_', ' ')}
                </Text>
              </View>
            )}
            {post.genre && (
              <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 mb-2">
                <Text style={{ fontSize: 15, color: '#374151' }}>{post.genre}</Text>
              </View>
            )}
            {post.swap_type && (
              <View className="bg-blue-100 px-3 py-1.5 rounded-full mb-2">
                <Text style={{ fontSize: 15, color: '#1d4ed8' }} className="capitalize">{post.swap_type}</Text>
              </View>
            )}
          </View>

          {/* Availability */}
          <View
            className={`px-4 py-3 rounded-lg mb-6 ${
              post.availability === 'available'
                ? 'bg-green-100'
                : post.availability === 'pending'
                ? 'bg-yellow-100'
                : 'bg-gray-100'
            }`}
          >
            <Text
              style={{ fontSize: 15, fontWeight: '600' }}
              className={
                post.availability === 'available'
                  ? 'text-green-700'
                  : post.availability === 'pending'
                  ? 'text-yellow-700'
                  : 'text-gray-700'
              }
            >
              {post.availability === 'available'
                ? 'Available for swap'
                : post.availability === 'pending'
                ? 'Swap pending'
                : 'Already swapped'}
            </Text>
          </View>

          {/* Owner */}
          <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Posted by</Text>
          <TouchableOpacity
            onPress={handleUserPress}
            className="flex-row items-center bg-gray-50 rounded-xl p-4 mb-6"
          >
            <Avatar
              avatarUrl={post.user?.avatar_url}
              username={post.user?.username || 'User'}
              size={50}
            />
            <View className="ml-4 flex-1">
              <Text style={{ fontSize: 17, fontWeight: '600' }}>@{post.user?.username}</Text>
              {(post.user as any)?.city && (
                <Text style={{ fontSize: 15, color: '#6b7280' }}>{(post.user as any).city}</Text>
              )}
            </View>
            <Text style={{ fontSize: 18, color: '#9ca3af' }}>→</Text>
          </TouchableOpacity>

          {/* Request Swap Button */}
          {!isOwnPost && post.availability === 'available' && (
            checkingSwap ? (
              <View className="bg-gray-200 py-4 rounded-xl">
                <Text style={{ fontSize: 17, color: '#6b7280', textAlign: 'center' }}>
                  Checking...
                </Text>
              </View>
            ) : canSwap ? (
              <TouchableOpacity
                onPress={handleRequestSwap}
                className="bg-green-500 py-4 rounded-xl"
              >
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff', textAlign: 'center' }}>
                  Request Swap
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-yellow-100 py-4 rounded-xl">
                <Text style={{ fontSize: 15, color: '#92400e', textAlign: 'center' }}>
                  Swap request already sent
                </Text>
              </View>
            )
          )}

          {!isOwnPost && post.availability === 'pending' && (
            <View className="bg-yellow-100 py-4 rounded-xl">
              <Text style={{ fontSize: 15, color: '#92400e', textAlign: 'center' }}>
                Swap in progress
              </Text>
            </View>
          )}

          {!isOwnPost && post.availability === 'swapped' && (
            <View className="bg-gray-100 py-4 rounded-xl">
              <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center' }}>
                No longer available
              </Text>
            </View>
          )}

          {isOwnPost && (
            <View className="bg-gray-100 py-4 rounded-xl">
              <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center' }}>This is your post</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Swap Request Modal */}
      <Modal
        visible={showSwapModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSwapModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-end bg-black/50"
        >
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <View className="flex-row justify-between items-center mb-4">
              <Text style={{ fontSize: 20, fontWeight: '700' }}>Request Swap</Text>
              <TouchableOpacity onPress={() => setShowSwapModal(false)}>
                <Text style={{ fontSize: 16, color: '#6b7280' }}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 15, color: '#6b7280', marginBottom: 16 }}>
              Send a message with your request to @{post?.user?.username} (optional)
            </Text>

            <TextInput
              value={swapMessage}
              onChangeText={setSwapMessage}
              placeholder="Hi! I'd love to swap for this book..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
              style={{
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 12,
                padding: 16,
                fontSize: 16,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />

            <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 8, textAlign: 'right' }}>
              {swapMessage.length}/500
            </Text>

            <TouchableOpacity
              onPress={submitSwapRequest}
              disabled={submitting}
              className={`py-4 rounded-xl mt-4 ${submitting ? 'bg-green-300' : 'bg-green-500'}`}
            >
              <Text style={{ fontSize: 17, fontWeight: '600', color: '#fff', textAlign: 'center' }}>
                {submitting ? 'Sending...' : 'Send Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
