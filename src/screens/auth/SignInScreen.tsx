import { useState } from 'react';
import { fonts } from '../../theme/fonts';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { supabase } from '../../config/supabase';

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
});

interface Props {
  navigation: any;
}

export default function SignInScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) throw error;
      // Navigation will be handled by auth state listener
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in');
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
          <TouchableOpacity onPress={() => navigation.goBack()} className="mb-8">
            <Text className="text-primary text-base">← Back</Text>
          </TouchableOpacity>

          <Text className="text-3xl mb-2" style={{ fontFamily: fonts.serifBold }}>Welcome Back</Text>
          <Text className="text-gray-500 mb-8">Sign in to continue</Text>

          <Text className="text-sm text-gray-600 mb-2">Email</Text>
          <TextInput
            placeholder="you@example.com"
            value={email}
            onChangeText={(text) => setEmail(text.toLowerCase())}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.textInput}
          />

          <Text className="text-sm text-gray-600 mb-2">Password</Text>
          <TextInput
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.textInput, { marginBottom: 32 }]}
          />

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={loading || !email || !password}
            className={`py-4 rounded-xl ${
              email && password && !loading ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
