import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { Swap } from '../../models/Swap';
import { getReceivedSwaps, getSentSwaps, acceptSwap, declineSwap } from '../../services/swapsService';
import Avatar from '../../components/Avatar';
import BookCover from '../../components/BookCover';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getBlockedUserIds } from '../../services/blockService';

interface Props {
  navigation: any;
}

export default function InboxScreen({ navigation }: Props) {
  const route = useRoute();
  const initialTab = (route.params as any)?.tab || 'received';
  const session = useAuthStore((state) => state.session);

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>(initialTab);
  const [receivedSwaps, setReceivedSwaps] = useState<Swap[]>([]);
  const [sentSwaps, setSentSwaps] = useState<Swap[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSwaps();
    }, [session])
  );

  useEffect(() => {
    if (!session?.user.id) return;

    // Subscribe to real-time updates for new swaps
    const channel = supabase
      .channel('swaps-inbox')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swaps',
          filter: `owner_id=eq.${session.user.id}`,
        },
        () => {
          loadSwaps();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swaps',
          filter: `requester_id=eq.${session.user.id}`,
        },
        () => {
          loadSwaps();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const loadSwaps = async () => {
    if (!session?.user.id) return;

    try {
      const [received, sent, blockedIds] = await Promise.all([
        getReceivedSwaps(session.user.id),
        getSentSwaps(session.user.id),
        getBlockedUserIds(session.user.id),
      ]);
      const blockedSet = new Set(blockedIds);
      setReceivedSwaps(received.filter((s) => !blockedSet.has(s.requester_id)));
      setSentSwaps(sent.filter((s) => !blockedSet.has(s.owner_id)));
    } catch (error) {
      console.error('Error loading swaps:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSwaps();
  };

  const handleAccept = async (swap: Swap) => {
    Alert.alert(
      'Accept Swap Request',
      `Accept swap request from @${swap.requester?.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await acceptSwap(swap.id);
              loadSwaps();
              navigation.navigate('Chat', { swapId: swap.id });
            } catch (error) {
              console.error('Error accepting swap:', error);
              Alert.alert('Error', 'Failed to accept swap request');
            }
          },
        },
      ]
    );
  };

  const handleDecline = async (swap: Swap) => {
    Alert.alert(
      'Decline Swap Request',
      `Decline swap request from @${swap.requester?.username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineSwap(swap.id);
              loadSwaps();
            } catch (error) {
              console.error('Error declining swap:', error);
              Alert.alert('Error', 'Failed to decline swap request');
            }
          },
        },
      ]
    );
  };

  const handleSwapPress = (swap: Swap) => {
    if (swap.status === 'accepted') {
      navigation.navigate('Chat', { swapId: swap.id });
    }
  };

  const renderReceivedItem = ({ item: swap }: { item: Swap }) => (
    <TouchableOpacity
      onPress={() => handleSwapPress(swap)}
      disabled={swap.status === 'pending'}
      className="bg-white mx-4 my-2 p-4 rounded-xl"
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}
    >
      <View className="flex-row">
        {/* Book Cover */}
        <BookCover
          coverUrl={swap.post?.cover_image_url || swap.post?.image_url}
          width={60}
          height={84}
          style={{ borderRadius: 6 }}
        />

        {/* Info */}
        <View className="flex-1 ml-3">
          <View className="flex-row items-center mb-1">
            <Avatar
              avatarUrl={swap.requester?.avatar_url}
              username={swap.requester?.username || 'User'}
              size={24}
            />
            <Text style={{ fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              @{swap.requester?.username}
            </Text>
            {swap.status === 'accepted' && (
              <View className="bg-green-100 px-2 py-0.5 rounded-full ml-2">
                <Text style={{ fontSize: 12, color: '#15803d' }}>Active</Text>
              </View>
            )}
          </View>

          <Text style={{ fontSize: 14, color: '#374151' }} numberOfLines={1}>
            {swap.post?.title}
          </Text>

          {swap.request_message && (
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }} numberOfLines={2}>
              "{swap.request_message}"
            </Text>
          )}
        </View>
      </View>

      {/* Actions for pending */}
      {swap.status === 'pending' && (
        <View className="flex-row mt-4 gap-3">
          <TouchableOpacity
            onPress={() => handleDecline(swap)}
            className="flex-1 py-2.5 rounded-lg bg-gray-100"
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#6b7280', textAlign: 'center' }}>
              Decline
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleAccept(swap)}
            className="flex-1 py-2.5 rounded-lg bg-green-500"
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', textAlign: 'center' }}>
              Accept
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tap to chat hint for accepted */}
      {swap.status === 'accepted' && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text style={{ fontSize: 13, color: '#38B6FF', textAlign: 'center' }}>
            Tap to open chat →
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderSentItem = ({ item: swap }: { item: Swap }) => (
    <TouchableOpacity
      onPress={() => handleSwapPress(swap)}
      disabled={swap.status === 'pending'}
      className="bg-white mx-4 my-2 p-4 rounded-xl"
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}
    >
      <View className="flex-row">
        {/* Book Cover */}
        <BookCover
          coverUrl={swap.post?.cover_image_url || swap.post?.image_url}
          width={60}
          height={84}
          style={{ borderRadius: 6 }}
        />

        {/* Info */}
        <View className="flex-1 ml-3">
          <View className="flex-row items-center mb-1">
            <Avatar
              avatarUrl={swap.owner?.avatar_url}
              username={swap.owner?.username || 'User'}
              size={24}
            />
            <Text style={{ fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              @{swap.owner?.username}
            </Text>
            <View
              className={`px-2 py-0.5 rounded-full ml-2 ${
                swap.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'
              }`}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: swap.status === 'pending' ? '#92400e' : '#15803d',
                }}
              >
                {swap.status === 'pending' ? 'Pending' : 'Accepted'}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 14, color: '#374151' }} numberOfLines={1}>
            {swap.post?.title}
          </Text>

          {swap.request_message && (
            <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }} numberOfLines={2}>
              Your message: "{swap.request_message}"
            </Text>
          )}
        </View>
      </View>

      {/* Status hint */}
      {swap.status === 'pending' && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
            Waiting for response...
          </Text>
        </View>
      )}

      {swap.status === 'accepted' && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text style={{ fontSize: 13, color: '#38B6FF', textAlign: 'center' }}>
            Tap to open chat →
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const currentSwaps = activeTab === 'received' ? receivedSwaps : sentSwaps;
  const pendingCount = receivedSwaps.filter((s) => s.status === 'pending').length;

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-2 pb-4 bg-white">
        <Text style={{ fontSize: 28, fontWeight: '700' }}>Inbox</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setActiveTab('received')}
          className={`flex-1 py-3 ${activeTab === 'received' ? 'border-b-2 border-blue-500' : ''}`}
        >
          <View className="flex-row justify-center items-center">
            <Text
              style={{
                fontSize: 15,
                fontWeight: activeTab === 'received' ? '600' : '400',
                color: activeTab === 'received' ? '#38B6FF' : '#6b7280',
              }}
            >
              Received
            </Text>
            {pendingCount > 0 && (
              <View className="bg-red-500 rounded-full ml-2 px-1.5 py-0.5 min-w-[20px]">
                <Text style={{ fontSize: 12, color: '#fff', textAlign: 'center', fontWeight: '600' }}>
                  {pendingCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('sent')}
          className={`flex-1 py-3 ${activeTab === 'sent' ? 'border-b-2 border-blue-500' : ''}`}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: activeTab === 'sent' ? '600' : '400',
              color: activeTab === 'sent' ? '#38B6FF' : '#6b7280',
              textAlign: 'center',
            }}
          >
            Sent
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={currentSwaps}
        keyExtractor={(item) => item.id}
        renderItem={activeTab === 'received' ? renderReceivedItem : renderSentItem}
        contentContainerStyle={{ paddingVertical: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📬</Text>
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#374151' }}>
              {activeTab === 'received' ? 'No swap requests yet' : 'No requests sent'}
            </Text>
            <Text style={{ fontSize: 15, color: '#6b7280', marginTop: 4, textAlign: 'center', paddingHorizontal: 40 }}>
              {activeTab === 'received'
                ? 'When someone wants to swap for your books, you\'ll see their requests here'
                : 'Browse books and request swaps to see them here'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
