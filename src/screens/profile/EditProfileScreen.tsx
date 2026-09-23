import { useState, useEffect } from 'react';
import { fonts } from '../../theme/fonts';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabase';
import { Camera, Check } from 'phosphor-react-native';
import { useAuthStore } from '../../store/authStore';
import { uploadAvatar } from '../../services/storageService';
import Avatar from '../../components/Avatar';
import CityAutocomplete from '../../components/CityAutocomplete';
import { CityResult, cityDisplayName } from '../../services/placesService';
import { sanitizeUsername, getUsernameError } from '../../utils/validation';

interface Props {
  navigation: any;
}

export default function EditProfileScreen({ navigation }: Props) {
  const { profile, setProfile } = useAuthStore();

  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url || null);
  const [username, setUsername] = useState(profile?.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [city, setCity] = useState(profile?.city || '');
  // Coordinates of the picked suggestion; cleared if the city text is edited by hand.
  const [cityCoords, setCityCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [bio, setBio] = useState(profile?.bio || '');
  const [loading, setLoading] = useState(false);

  const usernameChanged = !!profile && username !== profile.username;

  // Debounced availability check (only when the username actually changed)
  useEffect(() => {
    if (!usernameChanged || getUsernameError(username)) {
      setCheckingUsername(false);
      setUsernameAvailable(!usernameChanged);
      return;
    }
    setCheckingUsername(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (cancelled) return;
      setCheckingUsername(false);
      if (error) return; // the unique constraint still guards the save
      setUsernameAvailable(!data);
      setUsernameError(data ? 'Username already taken' : '');
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, usernameChanged]);

  const handleUsernameChange = (text: string) => {
    const cleaned = sanitizeUsername(text);
    setUsername(cleaned);
    setUsernameError(getUsernameError(cleaned) || '');
  };

  const handleCityText = (text: string) => {
    setCity(text);
    setCityCoords(null);
  };

  const handleCityPick = (c: CityResult) => {
    setCity(cityDisplayName(c));
    setCityCoords({ latitude: c.latitude, longitude: c.longitude });
  };

  const canSave = !loading && !checkingUsername && !usernameError && usernameAvailable && username.length > 0;

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
    if (!profile || !canSave) return;

    setLoading(true);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload new avatar if changed
      if (avatarUri && !avatarUri.startsWith('http')) {
        avatarUrl = await uploadAvatar(avatarUri, profile.id);
      }

      const updates: Record<string, any> = {
        avatar_url: avatarUrl,
        city: city.trim() || null,
        bio: bio.trim() || null,
      };
      if (usernameChanged) updates.username = username;
      // A picked city gives rough coordinates for nearby swaps + wishlist alerts.
      // Don't overwrite a precise GPS location the Feed already saved.
      if (cityCoords && !profile.location) {
        updates.location = `POINT(${cityCoords.longitude} ${cityCoords.latitude})`;
      }

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      Alert.alert('Success', 'Profile updated successfully');
      navigation.goBack();
    } catch (error: any) {
      if (error?.code === '23505') {
        // Unique violation — someone grabbed the username since we checked
        setUsernameAvailable(false);
        setUsernameError('Username already taken');
        Alert.alert('Username taken', 'Someone just took that username. Please pick another.');
      } else {
        Alert.alert('Error', error.message || 'Failed to update profile');
      }
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
            <Text className="text-lg" style={{ fontFamily: fonts.serifSemiBold }}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={!canSave}>
              <Text className={`text-base font-semibold ${!canSave ? 'text-gray-400' : 'text-primary'}`}>
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

            {/* Username */}
            <Text className="text-sm text-gray-500 mb-2">Username</Text>
            <View style={styles.usernameRow}>
              <Text style={{ fontSize: 16, color: '#9ca3af' }}>@</Text>
              <TextInput
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                style={{ flex: 1, fontSize: 16, marginLeft: 2 }}
              />
              {checkingUsername ? (
                <ActivityIndicator size="small" color="#38B6FF" />
              ) : usernameChanged && usernameAvailable && !usernameError ? (
                <Check size={18} color="#16a34a" weight="bold" />
              ) : null}
            </View>
            <Text style={{ fontSize: 12, color: usernameError ? '#ef4444' : '#9ca3af', marginBottom: 16, marginTop: 6 }}>
              {usernameError || 'Lowercase letters, numbers and underscores, 3–20 characters.'}
            </Text>

            {/* Email (read-only) */}
            <Text className="text-sm text-gray-500 mb-2">Email</Text>
            <View className="bg-gray-100 rounded-xl px-4 py-4 mb-4">
              <Text className="text-gray-600">{profile.email}</Text>
            </View>

            {/* City */}
            <Text className="text-sm text-gray-500 mb-2">City</Text>
            <CityAutocomplete value={city} onChangeText={handleCityText} onSelect={handleCityPick} />

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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
