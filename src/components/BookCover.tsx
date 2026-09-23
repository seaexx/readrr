import { View } from 'react-native';
import { Image } from 'expo-image';
import { Book } from 'phosphor-react-native';
import { hiResCoverUrl } from '../services/booksService';

interface Props {
  coverUrl: string | null | undefined;
  width: number;
  height: number;
  style?: any;
  contentFit?: 'cover' | 'contain';
}

export default function BookCover({ coverUrl, width, height, style, contentFit = 'cover' }: Props) {
  if (!coverUrl) {
    return (
      <View
        style={[{ width, height, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }, style]}
      >
        <Book size={Math.min(width, height) * 0.4} color="#9ca3af" weight="duotone" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: hiResCoverUrl(coverUrl) ?? coverUrl }}
      style={[{ width, height }, style]}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={150}
    />
  );
}
