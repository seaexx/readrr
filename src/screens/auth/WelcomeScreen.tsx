import { View, Text, TouchableOpacity } from 'react-native';
import SafeAreaView from '../../components/SafeAreaView';
import { Image } from 'expo-image';
import { fonts } from '../../theme/fonts';

interface Props {
  navigation: any;
}

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <View className="flex-1 justify-center items-center px-6">
        {/* Banner */}
        <Image
          source={require('../../../assets/images/banner.png')}
          style={{ width: 300, height: 180, marginBottom: 8 }}
          contentFit="contain"
        />
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-12" style={{ fontFamily: fonts.serifRegular, fontSize: 17 }}>
          Swap books with readers nearby
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('SignUp')}
          className="bg-primary w-full py-4 rounded-xl mb-4"
        >
          <Text className="text-white text-center font-semibold text-lg">
            Get Started
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('SignIn')}
          className="border border-gray-300 dark:border-gray-600 w-full py-4 rounded-xl"
        >
          <Text className="text-gray-700 dark:text-gray-200 text-center font-semibold text-lg">
            Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
