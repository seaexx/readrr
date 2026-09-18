import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabase';
import { Camera } from 'phosphor-react-native';
import { useAuthStore } from '../../store/authStore';
import { uploadAvatar } from '../../services/storageService';
import Avatar from '../../components/Avatar';

interface Props {
  navigation: any;
}

export default function EditProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useAuthStore();

  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [city, setCity] = useState(profile?.city || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setLoading(true);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload new avatar if changed
      if (avatarUri && !avatarUri.startsWith('http')) {
        avatarUrl = await uploadAvatar(avatarUri, profile.id);
      }

      // Update profile
      const { data, error } = await supabase
        .from('users')
        .update({
          avatar_url: avatarUrl,
          city: city.trim() || null,
          bio: bio.trim() || null,
        })
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <SafeAreaView className="flex-1">
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text className="text-primary text-base">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-semibold text-lg">Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              <Text className={`text-base font-semibold ${loading ? 'text-gray-400' : 'text-primary'}`}>
                {loading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="px-6 pt-6">
            {/* Avatar */}
            <TouchableOpacity onPress={pickImage} className="self-center mb-6">
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              ) : (
                <Avatar avatarUrl={null} username={profile.username} size={100} />
              )}
              <View className="absolute bottom-0 right-0 bg-primary w-8 h-8 rounded-full items-center justify-center">
                <Camera size={16} color="#fff" weight="duotone" />
              </View>
            </TouchableOpacity>

            {/* Username (read-only) */}
            <Text className="text-sm text-gray-500 mb-2">Username</Text>
            <View className="bg-gray-100 rounded-xl px-4 py-4 mb-4">
              <Text className="text-gray-600">@{profile.username}</Text>
            </View>

            {/* Email (read-only) */}
            <Text className="text-sm text-gray-500 mb-2">Email</Text>
            <View className="bg-gray-100 rounded-xl px-4 py-4 mb-4">
              <Text className="text-gray-600">{profile.email}</Text>
            </View>

            {/* City */}
            <Text className="text-sm text-gray-500 mb-2">City</Text>
            <TextInput
              placeholder="Where are you located?"
              value={city}
              onChangeText={setCity}
              maxLength={100}
              style={styles.textInput}
            />

            {/* Bio */}
            <Text className="text-sm text-gray-500 mb-2">Bio</Text>
            <TextInput
              placeholder="Tell us about yourself..."
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              maxLength={300}
              style={[styles.textInput, styles.textArea]}
            />
            <Text className="text-gray-400 text-xs text-right mb-4">
              {bio.length}/300
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
