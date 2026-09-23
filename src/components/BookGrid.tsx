import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Post } from '../models/Post';
import BookCover from './BookCover';
import { fonts } from '../theme/fonts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - 32 - GRID_GAP) / 2; // 2 columns, 16px side padding
const CARD_H = Math.round(CARD_W * 1.5);

interface Props {
  posts: Post[];
  onPress: (post: Post) => void;
  onLongPress?: (post: Post) => void;
}

// Two-column cover grid used on Profile and other readers' profiles.
export default function BookGrid({ posts, onPress, onLongPress }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        paddingTop: 16,
        columnGap: GRID_GAP,
      }}
    >
      {posts.map((item) => {
        const unavailable = item.post_type === 'swap' && item.availability !== 'available';

        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onPress(item)}
            onLongPress={onLongPress ? () => onLongPress(item) : undefined}
            delayLongPress={400}
            activeOpacity={0.85}
            style={{ width: CARD_W, marginBottom: 18 }}
          >
            <View
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 8,
                backgroundColor: '#fff',
                shadowColor: '#1e293b',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.16,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <View style={{ width: '100%', height: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' }}>
                {item.post_type === 'swap' && item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                ) : (
                  <BookCover coverUrl={item.cover_image_url} width={CARD_W} height={CARD_H} style={{ borderRadius: 8 }} />
                )}
                {unavailable && (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                      {item.availability === 'pending' ? 'PENDING' : 'SWAPPED'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={{ fontSize: 13, fontFamily: fonts.serifMedium, color: '#1a1a1a', marginTop: 6 }} numberOfLines={1}>
              {item.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
