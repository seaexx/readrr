import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { Swap } from '../../models/Swap';
import { Message } from '../../models/Message';
import {
  getSwap,
  confirmSwapComplete,
  acceptMeetup,
  clearMeetup,
} from '../../services/swapsService';
import { getMessages, sendMessage, markMessagesAsRead } from '../../services/messagesService';
import { hasRated } from '../../services/ratingsService';
import Avatar from '../../components/Avatar';
import LoadingSpinner from '../../components/LoadingSpinner';
import RatingModal from '../../components/RatingModal';
import MeetupModal from '../../components/MeetupModal';
import { sendPushNotification } from '../../services/notificationsService';

const CATEGORY_META: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  coffee_shop:      { label: 'Coffee Shop',    emoji: '☕', bg: '#fef3c7', text: '#92400e' },
  library:          { label: 'Library',         emoji: '📚', bg: '#dbeafe', text: '#1e40af' },
  bookshop:         { label: 'Bookshop',        emoji: '📖', bg: '#ede9fe', text: '#5b21b6' },
  bar:              { label: 'Bar',             emoji: '🍺', bg: '#ffedd5', text: '#c2410c' },
  book_club:        { label: 'Book Club',       emoji: '📗', bg: '#dcfce7', text: '#166534' },
  community_space:  { label: 'Community Space', emoji: '🏛',  bg: '#ccfbf1', text: '#0f766e' },
  other:            { label: 'Other',           emoji: '📍', bg: '#f3f4f6', text: '#4b5563' },
};

interface Props {
  navigation: any;
}

export default function ChatScreen({ navigation }: Props) {
  const route = useRoute();
  const { swapId } = route.params as { swapId: string };
  const session = useAuthStore((state) => state.session);

  const [swap, setSwap] = useState<Swap | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showMeetupModal, setShowMeetupModal] = useState(false);
  const [meetupLoading, setMeetupLoading] = useState(false);
  const [isCounterProposal, setIsCounterProposal] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadData();
  }, [swapId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!swapId) return;

    const channel = supabase
      .channel(`messages-${swapId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `swap_id=eq.${swapId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;

          const { data: fullMessage } = await supabase
            .from('messages')
            .select(`
              *,
              sender:users!messages_sender_id_fkey(id, username, avatar_url)
            `)
            .eq('id', newMsg.id)
            .single();

          if (fullMessage) {
            setMessages((prev) => {
              if (prev.find((m) => m.id === fullMessage.id)) return prev;
              return [...prev, fullMessage];
            });
          }

          if (newMsg.sender_id !== session?.user.id) {
            markMessagesAsRead(swapId, session?.user.id || '');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [swapId, session]);

  // Subscribe to swap row updates (for meetup location changes)
  useEffect(() => {
    if (!swapId) return;

    const channel = supabase
      .channel(`swap-updates-${swapId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'swaps',
          filter: `id=eq.${swapId}`,
        },
        async () => {
          const updated = await getSwap(swapId);
          if (updated) setSwap(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [swapId]);

  const loadData = async () => {
    try {
      const [swapData, messagesData] = await Promise.all([
        getSwap(swapId),
        getMessages(swapId),
      ]);

      if (!swapData) {
        Alert.alert('Error', 'Swap not found');
        navigation.goBack();
        return;
      }

      setSwap(swapData);
      setMessages(messagesData);

      if (session?.user.id) {
        markMessagesAsRead(swapId, session.user.id);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !session?.user.id || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      await sendMessage(swapId, session.user.id, messageText);
      // Notify the other party
      if (swap && session?.user.id) {
        const amOwner = swap.owner_id === session.user.id;
        const recipient = amOwner ? swap.requester : swap.owner;
        const myUsername = amOwner ? swap.owner?.username : swap.requester?.username;
        if (recipient?.id) {
          sendPushNotification(recipient.id, `@${myUsername}`, messageText).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageText);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleMarkComplete = () => {
    if (!swap || !session?.user.id) return;

    if (messages.length === 0) {
      Alert.alert(
        'Exchange Messages First',
        "You need to exchange at least one message with your swap partner before marking the swap as complete. This helps ensure you've coordinated the exchange."
      );
      return;
    }

    const isOwner = swap.owner_id === session.user.id;
    const alreadyConfirmed = isOwner
      ? swap.owner_confirmed_complete
      : swap.requester_confirmed_complete;

    if (alreadyConfirmed) {
      Alert.alert('Already Confirmed', 'You have already confirmed this swap as complete. Waiting for the other person to confirm.');
      return;
    }

    Alert.alert(
      'Mark Swap as Complete',
      'Have you successfully completed this book swap in person?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Complete',
          onPress: async () => {
            setCompleting(true);
            try {
              const { bothConfirmed } = await confirmSwapComplete(
                swapId,
                session.user.id,
                isOwner
              );

              if (bothConfirmed) {
                const alreadyRated = await hasRated(swapId, session.user.id);
                if (!alreadyRated) {
                  const updatedSwap = await getSwap(swapId);
                  setSwap(updatedSwap);
                  setShowRatingModal(true);
                } else {
                  navigation.goBack();
                }
              } else {
                Alert.alert(
                  'Waiting for Confirmation',
                  "You've confirmed the swap. Waiting for the other person to confirm."
                );
                const updatedSwap = await getSwap(swapId);
                setSwap(updatedSwap);
              }
            } catch (error) {
              console.error('Error completing swap:', error);
              Alert.alert('Error', 'Failed to mark swap as complete');
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleAcceptMeetup = async () => {
    setMeetupLoading(true);
    try {
      await acceptMeetup(swapId);
      // Realtime subscription will update swap state
    } catch {
      Alert.alert('Error', 'Failed to confirm meetup. Please try again.');
    } finally {
      setMeetupLoading(false);
    }
  };

  const handleClearMeetup = () => {
    Alert.alert(
      'Change Plans?',
      'This will reset your agreed meetup location so you can coordinate a new one.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setMeetupLoading(true);
            try {
              await clearMeetup(swapId);
            } catch {
              Alert.alert('Error', 'Failed to reset meetup. Please try again.');
            } finally {
              setMeetupLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderMessage = ({ item: message }: { item: Message }) => {
    const isOwnMessage = message.sender_id === session?.user.id;
    const time = new Date(message.created_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View className={`mx-4 my-1 ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        <View
          className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
            isOwnMessage ? 'bg-blue-500 rounded-br-sm' : 'bg-gray-200 rounded-bl-sm'
          }`}
        >
          <Text style={{ fontSize: 16, color: isOwnMessage ? '#fff' : '#1f2937' }}>
            {message.content}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, marginHorizontal: 4 }}>
          {time}
        </Text>
      </View>
    );
  };

  if (loading || !swap) {
    return <LoadingSpinner fullScreen />;
  }

  const isOwner = swap.owner_id === session?.user.id;
  const otherUser = isOwner ? swap.requester : swap.owner;

  // Completed swap screen
  if (swap.status === 'completed') {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top']}>
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Text style={{ fontSize: 16, color: '#38B6FF' }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: '600' }}>Swap Complete</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🎉</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            Swap Complete!
          </Text>
          <Text style={{ fontSize: 16, color: '#6b7280', textAlign: 'center', marginBottom: 24 }}>
            You successfully swapped "{swap.post?.title}" with @{otherUser?.username}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="bg-green-500 px-8 py-3 rounded-xl"
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Done</Text>
          </TouchableOpacity>
        </View>
        {otherUser && session?.user.id && (
          <RatingModal
            visible={showRatingModal}
            swapId={swapId}
            raterId={session.user.id}
            ratedUser={otherUser}
            onDone={() => { setShowRatingModal(false); navigation.goBack(); }}
            onSkip={() => { setShowRatingModal(false); navigation.goBack(); }}
          />
        )}
      </SafeAreaView>
    );
  }

  const myConfirmation = isOwner ? swap.owner_confirmed_complete : swap.requester_confirmed_complete;
  const theirConfirmation = isOwner ? swap.requester_confirmed_complete : swap.owner_confirmed_complete;
  const anyoneConfirmed = myConfirmation || theirConfirmation;

  // Meetup card derived values
  const meetupStatus = swap.meetup_status ?? 'none';
  const iProposed = meetupStatus === 'proposed' && swap.meetup_proposed_by === session?.user.id;
  const theyProposed = meetupStatus === 'proposed' && swap.meetup_proposed_by !== session?.user.id;
  const categoryMeta = swap.meetup_venue_category
    ? CATEGORY_META[swap.meetup_venue_category]
    : null;

  const renderMeetupCard = () => {
    if (swap.status !== 'accepted') return null;

    // State A: no proposal yet
    if (meetupStatus === 'none') {
      return (
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 4,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: '#d1d5db',
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 14, color: '#6b7280' }}>📍 Meet somewhere safe?</Text>
          <TouchableOpacity
            onPress={() => { setIsCounterProposal(false); setShowMeetupModal(true); }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#38B6FF' }}>
              Suggest a place
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // States B, C, D share a venue card base
    const venueRow = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Text style={{ fontSize: 22 }}>{categoryMeta?.emoji ?? '📍'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>
            {swap.meetup_venue_name}
          </Text>
          {swap.meetup_venue_address && (
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }} numberOfLines={1}>
              {swap.meetup_venue_address}
            </Text>
          )}
        </View>
        {categoryMeta && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: categoryMeta.bg,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: categoryMeta.text }}>
              {categoryMeta.label}
            </Text>
          </View>
        )}
      </View>
    );

    // State B: I proposed — waiting for other person
    if (iProposed) {
      return (
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: '#eff6ff',
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: '#bfdbfe',
          }}
        >
          {venueRow}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 13, color: '#3b82f6' }}>
              Waiting for @{otherUser?.username} to confirm…
            </Text>
            <TouchableOpacity
              onPress={() => { setIsCounterProposal(true); setShowMeetupModal(true); }}
              disabled={meetupLoading}
            >
              <Text style={{ fontSize: 13, color: '#6b7280' }}>Change</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // State C: they proposed — I can accept or counter
    if (theyProposed) {
      return (
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: '#fff7ed',
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: '#fed7aa',
          }}
        >
          <Text style={{ fontSize: 12, color: '#9a3412', marginBottom: 8, fontWeight: '600' }}>
            @{otherUser?.username} suggested a meetup spot:
          </Text>
          {venueRow}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={handleAcceptMeetup}
              disabled={meetupLoading}
              style={{
                flex: 1,
                backgroundColor: '#22c55e',
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              {meetupLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Accept This</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setIsCounterProposal(true); setShowMeetupModal(true); }}
              disabled={meetupLoading}
              style={{
                flex: 1,
                backgroundColor: '#f3f4f6',
                borderRadius: 8,
                paddingVertical: 8,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                Suggest Different
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // State D: agreed
    return (
      <View
        style={{
          marginHorizontal: 12,
          marginTop: 8,
          marginBottom: 4,
          backgroundColor: '#f0fdf4',
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: '#bbf7d0',
        }}
      >
        <Text style={{ fontSize: 12, color: '#15803d', fontWeight: '600', marginBottom: 8 }}>
          ✓ Meetup confirmed
        </Text>
        {venueRow}
        <TouchableOpacity onPress={handleClearMeetup} disabled={meetupLoading}>
          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Change plans?</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Text style={{ fontSize: 16, color: '#38B6FF' }}>← Back</Text>
        </TouchableOpacity>
        <Avatar
          avatarUrl={otherUser?.avatar_url}
          username={otherUser?.username || 'User'}
          size={36}
        />
        <View className="ml-3 flex-1">
          <Text style={{ fontSize: 16, fontWeight: '600' }}>@{otherUser?.username}</Text>
          <Text style={{ fontSize: 13, color: '#6b7280' }} numberOfLines={1}>
            {swap.post?.title}
          </Text>
        </View>
      </View>

      {/* Completion Status Banner */}
      {(myConfirmation || theirConfirmation) && swap.status === 'accepted' && (
        <View className="bg-yellow-50 px-4 py-2 border-b border-yellow-100">
          <Text style={{ fontSize: 13, color: '#92400e', textAlign: 'center' }}>
            {myConfirmation && !theirConfirmation
              ? '✓ You confirmed. Waiting for other person...'
              : !myConfirmation && theirConfirmation
              ? '⏳ Other person confirmed. Your turn to confirm!'
              : ''}
          </Text>
        </View>
      )}

      {/* Meetup Location Card */}
      {renderMeetupCard()}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingVertical: 16 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          onLayout={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center py-20">
              <Text style={{ fontSize: 48, marginBottom: 16 }}>💬</Text>
              <Text style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', paddingHorizontal: 40 }}>
                Start chatting to arrange your book swap!
              </Text>
            </View>
          }
        />

        {/* Mark Complete Button */}
        {swap.status === 'accepted' && (
          <TouchableOpacity
            onPress={handleMarkComplete}
            disabled={completing || (myConfirmation && !theirConfirmation)}
            className={`mx-4 py-3 rounded-xl ${myConfirmation ? 'bg-gray-200' : 'bg-green-500'}`}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: myConfirmation ? '#6b7280' : '#fff',
                textAlign: 'center',
              }}
            >
              {completing
                ? 'Processing...'
                : myConfirmation
                ? "✓ You've Confirmed"
                : '✓ Mark Swap as Complete'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Message input */}
        {anyoneConfirmed ? (
          <View className="px-4 py-4 border-t border-gray-100 bg-gray-50">
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
              {myConfirmation
                ? 'Chat disabled. Waiting for other person to confirm swap.'
                : 'Chat disabled. Please confirm the swap to complete.'}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-end px-4 py-3 border-t border-gray-100 bg-white">
            <TextInput
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={1000}
              style={{
                flex: 1,
                maxHeight: 100,
                backgroundColor: '#f3f4f6',
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 10,
                fontSize: 16,
              }}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!newMessage.trim() || sending}
              className={`ml-2 w-10 h-10 rounded-full items-center justify-center ${
                newMessage.trim() ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            >
              <Text style={{ fontSize: 18, color: newMessage.trim() ? '#fff' : '#9ca3af' }}>
                ↑
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {otherUser && session?.user.id && (
        <RatingModal
          visible={showRatingModal}
          swapId={swapId}
          raterId={session.user.id}
          ratedUser={otherUser}
          onDone={() => { setShowRatingModal(false); navigation.goBack(); }}
          onSkip={() => { setShowRatingModal(false); navigation.goBack(); }}
        />
      )}

      {session?.user.id && (
        <MeetupModal
          visible={showMeetupModal}
          swapId={swapId}
          proposerId={session.user.id}
          otherUserCity={otherUser?.city}
          isCounterProposal={isCounterProposal}
          onDone={() => setShowMeetupModal(false)}
          onCancel={() => setShowMeetupModal(false)}
        />
      )}
    </SafeAreaView>
  );
}
