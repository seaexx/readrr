import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/authStore';
import { likePost, unlikePost } from '../services/engagementService';
import { Post } from '../models/Post';
import Avatar from './Avatar';
import BookCover from './BookCover';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  post: Post;
  onPress?: () => void;
  onBlock?: (userId: string) => void;
  onReport?: (postId: string) => void;
}

export default function PostCard({ post, onPress, onBlock, onReport }: Props) {
  const navigation = useNavigation<any>();
  const session = useAuthStore((state) => state.session);

  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCounts();
    checkIfLiked();
  }, [post.id]);

  const loadCounts = async () => {
    try {
      const { count: likes } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      const { count: comments } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      setLikeCount(likes || 0);
      setCommentCount(comments || 0);
    } catch (error) {
      console.error('Error loading counts:', error);
    }
  };

  const checkIfLiked = async () => {
    if (!session) return;

    try {
      const { data } = await supabase
        .from('likes')
        .select('id')
        .match({ post_id: post.id, user_id: session.user.id })
        .maybeSingle();

      setHasLiked(!!data);
    } catch (error) {
      console.error('Error checking like:', error);
    }
  };

  const handleLike = async () => {
    if (!session || loading) return;

    const previousLiked = hasLiked;
    const previousCount = likeCount;

    // Optimistic update
    setHasLiked(!hasLiked);
    setLikeCount((prev) => (hasLiked ? prev - 1 : prev + 1));
    setLoading(true);

    try {
      if (previousLiked) {
        await unlikePost(post.id, session.user.id);
      } else {
        await likePost(post.id, session.user.id);
      }
    } catch (error) {
      // Revert on error
      setHasLiked(previousLiked);
      setLikeCount(previousCount);
      Alert.alert('Error', 'Failed to update like');
    } finally {
      setLoading(false);
    }
  };

  const handleComment = () => {
    navigation.navigate('PostDetail', { postId: post.id });
  };

  const handleUserPress = () => {
    if (post.user?.id === session?.user.id) {
      navigation.navigate('Profile');
    } else if (post.user?.id) {
      navigation.navigate('OtherUserProfile', { userId: post.user.id });
    }
  };

  const isOwnPost = post.user?.id === session?.user.id;

  const handleMenuPress = () => {
    Alert.alert(undefined as any, undefined as any, [
      {
        text: 'Report Post',
        onPress: () => onReport?.(post.id),
      },
      {
        text: 'Block User',
        style: 'destructive',
        onPress: () => {
          if (post.user?.id) {
            Alert.alert(
              'Block User',
              `Block @${post.user.username}? You won't see each other's posts or be able to swap.`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => onBlock?.(post.user!.id) },
              ]
            );
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handlePostPress = () => {
    if (onPress) {
      onPress();
    } else if (post.post_type === 'swap') {
      navigation.navigate('BookDetail', { postId: post.id });
    } else {
      navigation.navigate('PostDetail', { postId: post.id });
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <View className="bg-white mb-2 border-b border-gray-100">
      {/* Header */}
      <TouchableOpacity
        onPress={handleUserPress}
        className="flex-row items-center px-4 py-3"
      >
        <Avatar
          avatarUrl={post.user?.avatar_url}
          username={post.user?.username || 'User'}
          size={44}
        />
        <View className="ml-3 flex-1">
          <Text style={{ fontSize: 15, fontWeight: '600' }}>@{post.user?.username}</Text>
          <Text style={{ fontSize: 13, color: '#6b7280' }}>{timeAgo(post.created_at)}</Text>
        </View>
        {post.post_type === 'swap' && (
          <View className="bg-green-100 px-3 py-1.5 rounded-full">
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#15803d' }}>Swap</Text>
          </View>
        )}
        {!isOwnPost && (
          <TouchableOpacity onPress={handleMenuPress} style={{ paddingLeft: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 18, color: '#9ca3af', fontWeight: '700' }}>•••</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Content */}
      <TouchableOpacity onPress={handlePostPress} activeOpacity={0.9}>
        {/* Image - Different display for user photos vs book covers */}
        {post.post_type === 'swap' && post.image_url ? (
          // Swap posts with user's uploaded photo - full width
          <Image
            source={{ uri: post.image_url }}
            style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }}
            contentFit="cover"
          />
        ) : (
          // Social posts or swaps without photo: Use BookCover with zoom fallback
          <BookCover
            coverUrl={post.cover_image_url}
            width={SCREEN_WIDTH}
            height={SCREEN_WIDTH * 1.2}
          />
        )}

        {/* Book Info - below image like Instagram */}
        <View className="px-4 pt-3 pb-2">
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 2 }}>{post.title}</Text>
          {post.author && <Text style={{ fontSize: 15, color: '#4b5563' }}>{post.author}</Text>}
          {post.caption && (
            <Text style={{ fontSize: 15, color: '#1f2937', marginTop: 6 }}>{post.caption}</Text>
          )}
        </View>

        {/* Swap details */}
        {post.post_type === 'swap' && (
          <View className="px-4 pb-2 flex-row flex-wrap">
            {post.condition && (
              <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 mb-1">
                <Text style={{ fontSize: 14, color: '#374151' }} className="capitalize">
                  {post.condition.replace('_', ' ')}
                </Text>
              </View>
            )}
            {post.genre && (
              <View className="bg-gray-100 px-3 py-1.5 rounded-full mr-2 mb-1">
                <Text style={{ fontSize: 14, color: '#374151' }}>{post.genre}</Text>
              </View>
            )}
            {post.swap_type && (
              <View className="bg-blue-100 px-3 py-1.5 rounded-full mb-1">
                <Text style={{ fontSize: 14, color: '#1d4ed8' }} className="capitalize">{post.swap_type}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Engagement Buttons */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          onPress={handleLike}
          disabled={loading}
          className="flex-row items-center mr-6"
        >
          <Text className="text-2xl mr-2">{hasLiked ? '❤️' : '🤍'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleComment} className="flex-row items-center">
          <Text className="text-2xl mr-2">💬</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>{commentCount}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
