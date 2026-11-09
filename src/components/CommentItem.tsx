import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Avatar from './Avatar';
import { deleteComment } from '../services/engagementService';
import { useAuthStore } from '../store/authStore';
import { Comment } from '../models/Post';

interface Props {
  comment: Comment;
  onDelete?: () => void;
}

export default function CommentItem({ comment, onDelete }: Props) {
  const navigation = useNavigation<any>();
  const session = useAuthStore((state) => state.session);
  const isOwn = session?.user.id === comment.user_id;

  const handleDelete = () => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            onDelete?.();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete comment');
          }
        },
      },
    ]);
  };

  const handleUserPress = () => {
    if (comment.user_id === session?.user.id) {
      navigation.navigate('Profile');
    } else {
      navigation.navigate('OtherUserProfile', { userId: comment.user_id });
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
    <View className="flex-row px-4 py-3">
      <TouchableOpacity onPress={handleUserPress}>
        <Avatar
          avatarUrl={comment.user?.avatar_url}
          username={comment.user?.username || 'User'}
          size={32}
        />
      </TouchableOpacity>

      <View className="ml-3 flex-1">
        <View className="flex-row items-center mb-1">
          <TouchableOpacity onPress={handleUserPress}>
            <Text className="font-semibold mr-2 text-black dark:text-white">@{comment.user?.username}</Text>
          </TouchableOpacity>
          <Text className="text-gray-500 dark:text-gray-400 text-xs">{timeAgo(comment.created_at)}</Text>
        </View>

        <Text className="text-gray-800 dark:text-gray-200">{comment.content}</Text>

        {isOwn && (
          <TouchableOpacity onPress={handleDelete} className="mt-1">
            <Text className="text-red-500 text-xs">Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
