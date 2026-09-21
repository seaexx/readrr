import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/authStore';
import { Camera, Check } from 'phosphor-react-native';
import { fonts } from '../../theme/fonts';
import { sanitizeUsername, getUsernameError } from '../../utils/validation';
import { compressImage } from '../../utils/imageCompression';

const styles = StyleSheet.create({
  textInputNoBorder: {
    flex: 1,
    fontSize: 16,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 8,
  },
});

interface Props {
  navigation: any;
}

export default function ProfileSetupScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  const { user, profile, setProfile } = useAuthStore();

  // Pre-fill if profile exists (editing mode)
  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setUsernameAvailable(true);
      if (profile.avatar_url) {
        setAvatarUri(profile.avatar_url);
      }
    }
  }, [profile]);

  // Debounced username check
  useEffect(() => {
    if (!username || getUsernameError(username)) {
      setUsernameAvailable(false);
      return;
    }

    // Skip check if username hasn't changed from profile
    if (profile?.username === username) {
      setUsernameAvailable(true);
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  const checkUsernameAvailability = async (name: string) => {
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', name)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUsernameError('Username already taken');
        setUsernameAvailable(false);
      } else {
        setUsernameError('');
        setUsernameAvailable(true);
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (text: string) => {
    const cleaned = sanitizeUsername(text);
    setUsername(cleaned);
    setUsernameAvailable(false);

    const error = getUsernameError(cleaned);
    if (error) {
      setUsernameError(error);
    } else {
      setUsernameError('');
    }
  };

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
      const compressed = await compressImage(result.assets[0].uri);
      setAvatarUri(compressed);
    }
  };

  const handleSaveProfile = async () => {
    if (!username || usernameError || checkingUsername || !user) return;

    setLoading(true);
    try {
      const userId = user.id;

      // Upload avatar if it's a new local file
      let avatarUrl: string | null = profile?.avatar_url || null;
      if (avatarUri && !avatarUri.startsWith('http')) {
        const fileExt = 'jpg';
        const filePath = `${userId}/avatar.${fileExt}`;

        const response = await fetch(avatarUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl;
      }

      if (profile) {
        // Update existing profile
        const { data, error } = await supabase
          .from('users')
          .update({
            username,
            avatar_url: avatarUrl,
          })
          .eq('id', userId)
          .select()
          .single();

        if (error) throw error;
        setProfile(data);
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('users')
          .insert({
            id: userId,
            email: user.email!,
            username,
            avatar_url: avatarUrl,
          })
          .select()
          .single();

        if (error) throw error;
        setProfile(data);
      }

      // Profile saved — RootNavigator switches to the main app automatically.
      // The first post is optional now (prompted in Feed, not blocking).
    } catch (error: any) {
      console.error('Profile setup error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
        <View className="px-6 pt-16">
          <Text className="text-3xl mb-2 text-center" style={{ fontFamily: fonts.serifBold }}>Create Profile</Text>
          <Text className="text-gray-500 mb-8 text-center">
            {profile ? 'Update your profile' : 'Set up your profile to continue'}
          </Text>

          {/* Avatar Picker */}
          <TouchableOpacity onPress={pickImage} className="self-center mb-2">
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center">
                <Camera size={32} color="#fff" weight="duotone" />
              </View>
            )}
          </TouchableOpacity>
          <Text className="text-sm text-gray-500 text-center mb-1">
            Add photo (optional)
          </Text>
          <Text className="text-xs text-gray-400 text-center mb-8">Max 3MB</Text>

          {/* Username Input */}
          <Text className="text-sm text-gray-600 mb-2">Username</Text>
          <View style={styles.usernameContainer}>
            <Text className="text-lg text-gray-500 mr-1">@</Text>
            <TextInput
              placeholder="username"
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.textInputNoBorder}
            />
            {checkingUsername && <ActivityIndicator size="small" />}
            {usernameAvailable && !checkingUsername && (
              <Check size={18} color="#10b981" weight="bold" />
            )}
          </View>

          {usernameError ? (
            <Text className="text-error text-sm mb-4">{usernameError}</Text>
          ) : (
            <Text className="text-gray-400 text-sm mb-4">
              Lowercase letters, numbers, and underscores
            </Text>
          )}

          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={!usernameAvailable || loading}
            className={`py-4 rounded-xl ${
              usernameAvailable && !loading ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <Text className="text-xs text-gray-500 text-center mt-6">
            You can add your city and bio later in settings
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
