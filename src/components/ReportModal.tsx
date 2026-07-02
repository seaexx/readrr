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

const REASONS = ['Spam', 'Harassment', 'Inappropriate Content', 'Other'] as const;
type Reason = (typeof REASONS)[number];

interface Props {
  visible: boolean;
  label: string;
  onSubmit: (reason: string, details: string) => Promise<void>;
  onCancel: () => void;
}

export default function ReportModal({ visible, label, onSubmit, onCancel }: Props) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails('');
  };

  const handleSubmit = async () => {
    if (!reason) {
      Alert.alert('Select a reason', 'Please choose a reason for your report.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(reason, details);
      reset();
    } catch (error) {
      console.error('Report error:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2 }} />
          </View>

          <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 12, marginBottom: 4 }}>
            Report {label}
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 20 }}>
            Why are you reporting this {label.toLowerCase()}?
          </Text>

          <View style={{ gap: 10, marginBottom: 20 }}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                onPress={() => setReason(r)}
                style={{
                  backgroundColor: reason === r ? '#38B6FF' : '#f3f4f6',
                  borderRadius: 12,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: reason === r ? '#fff' : '#1f2937' }}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Add details (optional)"
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={500}
            style={{
              backgroundColor: '#f3f4f6',
              borderRadius: 12,
              padding: 12,
              fontSize: 15,
              color: '#1f2937',
              minHeight: 72,
              textAlignVertical: 'top',
              marginBottom: 20,
            }}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            style={{
              backgroundColor: submitting ? '#d1d5db' : '#ef4444',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCancel} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ fontSize: 15, color: '#6b7280' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
