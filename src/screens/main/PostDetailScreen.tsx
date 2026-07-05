import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRoute } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import {
  createComment,
  getPostComments,
  likePost,
  unlikePost,
} from '../../services/engagementService';
import { fetchBookByISBN } from '../../services/booksService';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';
import CommentItem from '../../components/CommentItem';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Post, Comment } from '../../models/Post';
import { HeartIcon, ChatBubbleLeftIcon } from 'react-native-heroicons/outline';
import { HeartIcon as HeartIconSolid } from 'react-native-heroicons/solid';

const SCREEN_WIDTH = Dimensions.get('window').width;
const LEFT_WIDTH = SCREEN_WIDTH * 0.4;
const RIGHT_WIDTH = SCREEN_WIDTH * 0.6;

interface Props {
  navigation: any;
}

export default function PostDetailScreen({ navigation }: Props) {
  const route = useRoute();
  const { postId } = route.params as { postId: string };
  const session = useAuthStore((state) => state.session);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [description, setDescription] = useState<string | null>(null);
  const [loadingDescription, setLoadingDescription] = useState(false);
  const [descriptionFetched, setDescriptionFetched] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToComments();
    return unsubscribe;
  }, [postId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    if (post?.isbn) {
      fetchDescription(post.isbn);
    } else if (post) {
      // No ISBN available, mark as fetched with no description
      setDescriptionFetched(true);
    }
  }, [post?.isbn]);

  const loadData = async () => {
    try {
      // Load post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*, user:users(id, username, avatar_url)')
        .eq('id', postId)
        .single();

      if (postError) throw postError;
      setPost(postData);

      // Load comments
      const commentsData = await getPostComments(postId);
      setComments(commentsData);

      // Load engagement counts
      const { count: likes } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      setLikeCount(likes || 0);

      // Check if user has liked
      if (session) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .match({ post_id: postId, user_id: session.user.id })
          .maybeSingle();
        setHasLiked(!!likeData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load post');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchDescription = async (isbn: string) => {
    console.log('📖 Fetching description for ISBN:', isbn);
    setLoadingDescription(true);
    try {
      const bookInfo = await fetchBookByISBN(isbn);
      console.log('📖 Book info received:', bookInfo.title, '| Description:', bookInfo.description ? 'YES' : 'NO');
      if (bookInfo.description) {
        setDescription(bookInfo.description);
      }
    } catch (error: any) {
      console.log('❌ Could not fetch description:', error.message);
    } finally {
      setLoadingDescription(false);
      setDescriptionFetched(true);
    }
  };

  const subscribeToComments = () => {
    const channel = supabase
      .channel(`comments:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('comments')
            .select('*, user:users(username, avatar_url)')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setComments((prev) => [...prev, data]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !session || posting) return;

    setPosting(true);

    try {
      await createComment(postId, session.user.id, newComment.trim());
      setNewComment('');
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async () => {
    if (!session) return;

    // Optimistic update
    setHasLiked(!hasLiked);
    setLikeCount((prev) => (hasLiked ? prev - 1 : prev + 1));

    try {
      if (hasLiked) {
        await unlikePost(postId, session.user.id);
      } else {
        await likePost(postId, session.user.id);
      }
    } catch (error) {
      // Revert on error
      setHasLiked(hasLiked);
      setLikeCount((prev) => (hasLiked ? prev + 1 : prev - 1));
    }
  };

  const handleCommentDelete = () => {
    // Comments will be removed via real-time subscription
  };

  if (loading || !post) {
    return <LoadingSpinner fullScreen />;
  }

  const imageUrl = post.image_url || post.cover_image_url;
  const truncatedDescription =
    description && description.length > 200
      ? description.substring(0, 200) + '...'
      : description;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={{ fontSize: 16, color: '#38B6FF' }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '600' }}>Post</Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Main Content - Side by Side */}
        <View className="flex-1 flex-row">
          {/* LEFT SIDE - Book Cover */}
          <View
            style={{ width: LEFT_WIDTH }}
            className="bg-gray-50 p-4 items-center"
          >
            {post.image_url ? (
              <Image
                source={{ uri: post.image_url }}
                style={{
                  width: LEFT_WIDTH - 32,
                  height: (LEFT_WIDTH - 32) * 1.5,
                  borderRadius: 8,
                }}
                contentFit="cover"
              />
            ) : (
              <BookCover
                coverUrl={post.cover_image_url}
                width={LEFT_WIDTH - 32}
                height={(LEFT_WIDTH - 32) * 1.5}
                style={{ borderRadius: 8 }}
              />
            )}
          </View>

          {/* RIGHT SIDE - Info + Comments */}
          <View style={{ width: RIGHT_WIDTH }} className="flex-1">
            <ScrollView
              className="flex-1 p-3"
              showsVerticalScrollIndicator={false}
            >
              {/* Book Title */}
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>{post.title}</Text>

              {/* Author */}
              {post.author && (
                <Text style={{ fontSize: 16, color: '#6b7280', marginBottom: 12 }}>
                  {post.author}
                </Text>
              )}

              {/* Description */}
              {loadingDescription && (
                <Text style={{ fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginBottom: 12 }}>
                  Loading description...
                </Text>
              )}
              {!loadingDescription && descriptionFetched && !description && (
                <Text style={{ fontSize: 14, color: '#9ca3af', fontStyle: 'italic', marginBottom: 12 }}>
                  No description available
                </Text>
              )}
              {description && (
                <View className="mb-3">
                  <Text style={{ fontSize: 15, color: '#374151', lineHeight: 22 }}>
                    {showFullDescription ? description : truncatedDescription}
                  </Text>
                  {description.length > 200 && (
                    <TouchableOpacity
                      onPress={() => setShowFullDescription(!showFullDescription)}
                    >
                      <Text style={{ fontSize: 14, color: '#38B6FF', marginTop: 4 }}>
                        {showFullDescription ? 'Show less' : 'Read more'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Divider */}
              <View className="h-px bg-gray-200 my-3" />

              {/* Posted By */}
              <TouchableOpacity
                className="flex-row items-center mb-3"
                onPress={() =>
                  navigation.navigate('OtherUserProfile', {
                    userId: post.user?.id,
                  })
                }
              >
                <Avatar
                  avatarUrl={post.user?.avatar_url}
                  username={post.user?.username || 'User'}
                  size={32}
                />
                <View className="ml-2">
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Posted by</Text>
                  <Text style={{ fontSize: 15, fontWeight: '500' }}>
                    @{post.user?.username}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Caption */}
              {post.caption && (
                <View className="mb-3 bg-gray-50 rounded-lg p-3">
                  <Text style={{ fontSize: 15, color: '#1f2937', lineHeight: 22 }}>
                    "{post.caption}"
                  </Text>
                </View>
              )}

              {/* Engagement Buttons */}
              <View className="flex-row items-center mb-4">
                <TouchableOpacity
                  onPress={handleLike}
                  className="flex-row items-center mr-6"
                  activeOpacity={0.7}
                >
                  {hasLiked ? (
                    <HeartIconSolid size={24} color="#E54B4B" style={{ marginRight: 4 }} />
                  ) : (
                    <HeartIcon size={24} color="#0072DD" style={{ marginRight: 4 }} />
                  )}
                  <Text style={{ fontSize: 15, color: '#374151', fontWeight: '500' }}>
                    {likeCount}
                  </Text>
                </TouchableOpacity>

                <View className="flex-row items-center">
                  <ChatBubbleLeftIcon size={24} color="#0072DD" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 15, color: '#374151', fontWeight: '500' }}>
                    {comments.length}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View className="h-px bg-gray-200 mb-3" />

              {/* Comments Section */}
              <Text style={{ fontSize: 17, fontWeight: '700', marginBottom: 12 }}>
                Comments ({comments.length})
              </Text>

              {comments.length === 0 ? (
                <Text style={{ fontSize: 15, color: '#6b7280', marginBottom: 16 }}>
                  No comments yet. Be the first!
                </Text>
              ) : (
                comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onDelete={handleCommentDelete}
                  />
                ))
              )}

              {/* Bottom padding for scroll */}
              <View className="h-4" />
            </ScrollView>
          </View>
        </View>

        {/* Comment Input */}
        <View className="border-t border-gray-200 px-4 flex-row items-center bg-white" style={{ paddingTop: 10, paddingBottom: keyboardVisible ? 10 : 60 }}>
          <TextInput
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            maxLength={500}
            style={styles.commentInput}
            className="flex-1 mr-3"
          />
          <TouchableOpacity
            onPress={handlePostComment}
            disabled={!newComment.trim() || posting}
            className={`px-4 py-2 rounded-full ${
              newComment.trim() && !posting ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <Text className="text-white font-semibold">
              {posting ? '...' : 'Post'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  commentInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
  },
});
