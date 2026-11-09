import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { submitRating } from '../services/ratingsService';
import Avatar from './Avatar';
import { Star } from 'phosphor-react-native';
import { fonts } from '../theme/fonts';
import { useThemeColors } from '../theme/colors';

interface Props {
  visible: boolean;
  swapId: string;
  raterId: string;
  ratedUser: { id: string; username: string; avatar_url?: string | null };
  onDone: () => void;
  onSkip: () => void;
}

export default function RatingModal({ visible, swapId, raterId, ratedUser, onDone, onSkip }: Props) {
  const ink = useThemeColors();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (score === 0) {
      Alert.alert('Select a rating', 'Please tap a star to rate this swap.');
      return;
    }

    setSubmitting(true);
    try {
      await submitRating(swapId, raterId, ratedUser.id, score, comment);
      onDone();
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: ink.isDark ? '#111827' : '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <Text style={{ fontSize: 21, fontFamily: fonts.serifSemiBold, color: ink.heading, textAlign: 'center', marginBottom: 4 }}>
            Rate your swap
          </Text>
          <Text style={{ fontSize: 14, color: ink.muted, textAlign: 'center', marginBottom: 20 }}>
            How was your experience?
          </Text>

          {/* Rated user */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <Avatar avatarUrl={ratedUser.avatar_url} username={ratedUser.username} size={64} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: ink.heading, marginTop: 8 }}>@{ratedUser.username}</Text>
          </View>

          {/* Stars */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 12 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setScore(star)}>
                <Star size={40} color={star <= score ? '#f59e0b' : ink.border} weight={star <= score ? 'fill' : 'regular'} />
              </TouchableOpacity>
            ))}
          </View>

          {score > 0 && (
            <Text style={{ textAlign: 'center', fontSize: 14, color: ink.muted, marginBottom: 16 }}>
              {score === 1 ? 'Poor' : score === 2 ? 'Fair' : score === 3 ? 'Good' : score === 4 ? 'Great' : 'Excellent!'}
            </Text>
          )}

          {/* Optional comment */}
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Leave a comment (optional)"
            placeholderTextColor={ink.subtle}
            multiline
            maxLength={300}
            style={{
              backgroundColor: ink.surface,
              borderRadius: 12,
              padding: 12,
              fontSize: 15,
              color: ink.strong,
              minHeight: 72,
              textAlignVertical: 'top',
              marginBottom: 20,
            }}
          />

          {/* Actions */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: '#38B6FF',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Submit Rating</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={onSkip} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ fontSize: 15, color: ink.muted }}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
