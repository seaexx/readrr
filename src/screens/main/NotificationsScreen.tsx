import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../../store/authStore';
import {
  AppNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationsService';

interface Props {
  navigation: any;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function notificationIcon(title: string): string {
  if (title.includes('accepted') || title.includes('🎉')) return '🎉';
  if (title.includes('Meetup') || title.includes('📍')) return '📍';
  if (title.includes('confirmed') || title.includes('✅')) return '✅';
  if (title.includes('swap') || title.includes('🔄')) return '🔄';
  return '💬';
}

export default function NotificationsScreen({ navigation }: Props) {
  const session = useAuthStore((state) => state.session);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [session?.user.id])
  );

  const loadNotifications = async () => {
    if (!session?.user.id) return;
    try {
      const data = await getNotifications(session.user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleNotificationPress = async (notification: AppNotification) => {
    // Mark as read
    if (!notification.read) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      );
    }

    // Navigate based on data payload
    const { screen, params } = notification.data || {};
    if (screen) {
      navigation.navigate(screen, params);
    }
  };

  const handleMarkAllRead = async () => {
    if (!session?.user.id) return;
    await markAllNotificationsRead(session.user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      onPress={() => handleNotificationPress(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: item.read ? '#fff' : '#eff6ff',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        gap: 12,
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: item.read ? '#f3f4f6' : '#dbeafe',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20 }}>{notificationIcon(item.title)}</Text>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: item.read ? '400' : '700',
            color: '#1f2937',
            marginBottom: 2,
          }}
        >
          {item.title}
        </Text>
        <Text style={{ fontSize: 14, color: '#6b7280' }} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
          {timeAgo(item.created_at)}
        </Text>
      </View>

      {/* Unread dot */}
      {!item.read && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#38B6FF',
            marginTop: 6,
          }}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#f3f4f6',
        }}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 16, color: '#38B6FF' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={{ fontSize: 14, color: '#38B6FF' }}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#374151' }}>
              No notifications yet
            </Text>
            <Text style={{ fontSize: 15, color: '#6b7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
              You'll be notified about swap requests, messages, and meetup updates
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
