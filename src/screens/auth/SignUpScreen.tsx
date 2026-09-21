import { useState } from 'react';
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
  Linking,
} from 'react-native';
import { supabase } from '../../config/supabase';
import { isValidEmail, isValidPassword } from '../../utils/validation';

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

export default function SignUpScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }
    if (!isValidPassword(password)) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      // Check if email already exists in users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (existingUser) {
        Alert.alert(
          'Email Already Exists',
          'An account with this email already exists. Please sign in instead.'
        );
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError) {
        // Handle specific Supabase auth errors
        if (authError.message.includes('already registered')) {
          Alert.alert(
            'Email Already Exists',
            'An account with this email already exists. Please sign in instead.'
          );
          return;
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('No user returned');
      }

      // Auth session will be picked up by listener and navigate to onboarding
    } catch (error: any) {
      console.error('Sign up error:', error);
      Alert.alert('Error', error.message || 'Failed to create account');
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

          <Text className="text-3xl mb-2" style={{ fontFamily: fonts.serifBold }}>Create Account</Text>
          <Text className="text-gray-500 mb-8">Enter your email and password</Text>

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
            placeholder="Min 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.textInput, { marginBottom: 32 }]}
          />

          <TouchableOpacity
            onPress={handleSignUp}
            disabled={!email || !password || loading}
            className={`py-4 rounded-xl ${
              email && password && !loading ? 'bg-primary' : 'bg-gray-300'
            }`}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Creating Account...' : 'Continue'}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 16, lineHeight: 18 }}>
            By continuing, you agree to our{' '}
            <Text style={{ color: '#38B6FF', fontWeight: '600' }} onPress={() => Linking.openURL('https://readrr.app/terms')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={{ color: '#38B6FF', fontWeight: '600' }} onPress={() => Linking.openURL('https://readrr.app/privacy')}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
