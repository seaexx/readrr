import { View, Text, TouchableOpacity } from 'react-native';
import { fonts } from '../../theme/fonts';
import SafeAreaView from '../../components/SafeAreaView';

interface Props {
  navigation: any;
}

export default function CreatePostScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-8">
        <Text className="text-3xl mb-8" style={{ fontFamily: fonts.serifBold }}>Create Post</Text>

        {/* Social Post Option */}
        <TouchableOpacity
          onPress={() => navigation.navigate('SocialPost')}
          className="bg-blue-500 rounded-xl p-6 mb-4"
        >
          <Text className="text-white text-xl mb-2" style={{ fontFamily: fonts.serifSemiBold }}>Social Post</Text>
          <Text className="text-white/90">Share what you're currently reading</Text>
        </TouchableOpacity>

        {/* Swap Post Option */}
        <TouchableOpacity
          onPress={() => navigation.navigate('SwapPost')}
          className="bg-green-500 rounded-xl p-6"
        >
          <Text className="text-white text-xl mb-2" style={{ fontFamily: fonts.serifSemiBold }}>Swap Post</Text>
          <Text className="text-white/90">Post a book available to swap</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-8">
          <Text className="text-gray-500 text-center">Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
