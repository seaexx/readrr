import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { proposeMeetup } from '../services/swapsService';
import { VenueCategory } from '../models/Swap';

// Unified result type for both Overpass and Nominatim results
interface VenueResult {
  id: string;
  name: string;
  address: string;
  source: 'overpass' | 'nominatim';
}

interface VenueChip {
  category: VenueCategory;
  label: string;
  emoji: string;
  color: string;
}

// Maps venue category to Overpass amenity/shop tag query fragment
const OVERPASS_TAG: Partial<Record<VenueCategory, string>> = {
  coffee_shop:      '"amenity"="cafe"',
  library:          '"amenity"="library"',
  bookshop:         '"shop"="books"',
  bar:              '"amenity"="bar"',
  book_club:        '"amenity"="community_centre"',
  community_space:  '"amenity"="community_centre"',
};

const VENUE_CHIPS: VenueChip[] = [
  { category: 'coffee_shop',     label: 'Coffee Shop',     emoji: '☕', color: '#92400e' },
  { category: 'library',         label: 'Library',          emoji: '📚', color: '#1e40af' },
  { category: 'bookshop',        label: 'Bookshop',         emoji: '📖', color: '#5b21b6' },
  { category: 'bar',             label: 'Bar',              emoji: '🍺', color: '#c2410c' },
  { category: 'book_club',       label: 'Book Club',        emoji: '📗', color: '#166534' },
  { category: 'community_space', label: 'Community Space',  emoji: '🏛',  color: '#0f766e' },
  { category: 'other',           label: 'Other',            emoji: '📍', color: '#4b5563' },
];

interface Props {
  visible: boolean;
  swapId: string;
  proposerId: string;
  otherUserCity?: string | null;
  isCounterProposal?: boolean;
  onDone: () => void;
  onCancel: () => void;
}

export default function MeetupModal({
  visible,
  swapId,
  proposerId,
  otherUserCity,
  isCounterProposal = false,
  onDone,
  onCancel,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<VenueCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyResults, setNearbyResults] = useState<VenueResult[]>([]);
  const [searchResults, setSearchResults] = useState<VenueResult[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<VenueResult | null>(null);
  const [customVenueName, setCustomVenueName] = useState('');
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNearbyVenues = useCallback(async (chip: VenueChip) => {
    const tag = OVERPASS_TAG[chip.category];
    if (!tag) return; // 'other' has no tag — skip Overpass

    setLoadingNearby(true);
    setNearbyResults([]);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lon } = location.coords;

      const query =
        `[out:json][timeout:10];` +
        `(node[${tag}](around:2000,${lat},${lon});` +
        `way[${tag}](around:2000,${lat},${lon}););` +
        `out center 8;`;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      const json = await response.json();
      const elements: any[] = json.elements || [];

      const results: VenueResult[] = elements
        .filter((el) => el.tags?.name)
        .map((el) => {
          const tags = el.tags;
          const addressParts = [
            tags['addr:housenumber'] && tags['addr:street']
              ? `${tags['addr:housenumber']} ${tags['addr:street']}`
              : tags['addr:street'],
            tags['addr:city'] || tags['addr:town'],
          ].filter(Boolean);

          return {
            id: `overpass-${el.id}`,
            name: tags.name,
            address: addressParts.join(', '),
            source: 'overpass' as const,
          };
        });

      setNearbyResults(results);
    } catch {
      // Silently fall back to text search
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  const runNominatimSearch = useCallback(async (text: string, chip: VenueChip | null) => {
    const q = [text.trim(), chip?.label, otherUserCity].filter(Boolean).join(' ');
    if (!q) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    try {
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=en`;

      const res = await fetch(url, { headers: { 'User-Agent': 'readrr-app' } });
      const json: any[] = await res.json();

      const results: VenueResult[] = json
        .filter((item) => item.name || item.display_name)
        .map((item) => ({
          id: `nominatim-${item.place_id}`,
          name: item.name || item.display_name.split(',')[0],
          address: item.display_name,
          source: 'nominatim' as const,
        }));

      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [otherUserCity]);

  const handleChipPress = async (chip: VenueChip) => {
    const next = selectedCategory === chip.category ? null : chip.category;
    setSelectedCategory(next);
    setSelectedVenue(null);
    setNearbyResults([]);
    setSearchResults([]);

    if (next) {
      const activeChip = VENUE_CHIPS.find((c) => c.category === next)!;
      fetchNearbyVenues(activeChip);
      if (searchQuery.trim()) {
        runNominatimSearch(searchQuery, activeChip);
      }
    }
  };

  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
    setSelectedVenue(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const chip = selectedCategory
        ? VENUE_CHIPS.find((c) => c.category === selectedCategory) || null
        : null;
      runNominatimSearch(text, chip);
    }, 500);
  };

  const handleVenuePress = (venue: VenueResult) => {
    setSelectedVenue(venue);
    setCustomVenueName(venue.name);
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert('Pick a category', 'Please select what kind of place this is.');
      return;
    }
    const venueName = selectedVenue?.name || customVenueName.trim();
    if (!venueName) {
      Alert.alert('Enter a place', 'Please select or type a venue name.');
      return;
    }

    setSubmitting(true);
    try {
      await proposeMeetup(
        swapId,
        proposerId,
        venueName,
        selectedCategory,
        selectedVenue?.address || undefined
      );
      resetState();
      onDone();
    } catch {
      Alert.alert('Error', 'Failed to suggest meetup. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setSelectedCategory(null);
    setSearchQuery('');
    setNearbyResults([]);
    setSearchResults([]);
    setSelectedVenue(null);
    setCustomVenueName('');
    setHasSearched(false);
    setLocationDenied(false);
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  // Show search results when typing, nearby when chip selected and no text
  const resultsToShow = searchQuery.trim() ? searchResults : nearbyResults;
  const resultsLabel = searchQuery.trim() ? 'Search results' : 'Nearby';
  const isLoadingResults = searchQuery.trim() ? searching : loadingNearby;
  const canSubmit =
    selectedCategory !== null && (selectedVenue !== null || customVenueName.trim().length > 0);

  const renderResultItem = ({ item }: { item: VenueResult }) => (
    <TouchableOpacity
      onPress={() => handleVenuePress(item)}
      style={{
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 16 }}>
        {item.source === 'overpass' ? '📍' : '🔍'}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: '#1f2937' }}>
          {item.name}
        </Text>
        {item.address ? (
          <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }} numberOfLines={1}>
            {item.address}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 36 : 24,
            maxHeight: '88%',
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: '#d1d5db',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: '700' }}>
              {isCounterProposal ? 'Suggest somewhere different' : 'Suggest a meetup spot'}
            </Text>
            <TouchableOpacity onPress={handleCancel}>
              <Text style={{ fontSize: 15, color: '#6b7280' }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ fontSize: 14, color: '#6b7280', paddingHorizontal: 20, marginBottom: 14 }}>
            Pick a safe public place to exchange your books.
          </Text>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
            style={{ marginBottom: 14 }}
          >
            {VENUE_CHIPS.map((chip) => {
              const active = selectedCategory === chip.category;
              return (
                <TouchableOpacity
                  key={chip.category}
                  onPress={() => handleChipPress(chip)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: active ? chip.color : '#e5e7eb',
                    backgroundColor: active ? chip.color + '18' : '#f9fafb',
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 15 }}>{chip.emoji}</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: active ? '600' : '400',
                      color: active ? chip.color : '#374151',
                    }}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Search input */}
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f3f4f6',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={handleQueryChange}
                placeholder={selectedCategory ? 'Search by name...' : 'Select a category first, then search...'}
                placeholderTextColor="#9ca3af"
                autoCorrect={false}
                style={{ flex: 1, fontSize: 16, color: '#1f2937' }}
              />
              {(searching) && <ActivityIndicator size="small" color="#9ca3af" />}
              {searchQuery.length > 0 && !searching && (
                <TouchableOpacity onPress={() => handleQueryChange('')}>
                  <Text style={{ fontSize: 15, color: '#9ca3af' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Nearby / search results */}
          {selectedCategory && (
            <>
              {isLoadingResults ? (
                <View style={{ paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#38B6FF" />
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>
                    {searchQuery.trim() ? 'Searching...' : 'Finding nearby spots...'}
                  </Text>
                </View>
              ) : resultsToShow.length > 0 ? (
                <>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280', paddingHorizontal: 20, marginBottom: 4 }}>
                    {resultsLabel}
                  </Text>
                  <FlatList
                    data={resultsToShow}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 200, marginBottom: 8 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={renderResultItem}
                  />
                </>
              ) : hasSearched && searchQuery.trim() ? (
                <Text style={{ fontSize: 13, color: '#9ca3af', paddingHorizontal: 20, marginBottom: 8 }}>
                  No results — enter the venue name manually below.
                </Text>
              ) : locationDenied && !searchQuery.trim() ? (
                <Text style={{ fontSize: 13, color: '#9ca3af', paddingHorizontal: 20, marginBottom: 8 }}>
                  Location access denied. Search by name or type it manually.
                </Text>
              ) : null}
            </>
          )}

          {/* Manual entry */}
          <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
              {selectedVenue ? 'Selected venue name:' : 'Or enter venue name manually:'}
            </Text>
            <TextInput
              value={customVenueName}
              onChangeText={(t) => { setCustomVenueName(t); if (selectedVenue) setSelectedVenue(null); }}
              placeholder="e.g. Central Library, The Book Nook..."
              placeholderTextColor="#9ca3af"
              style={{
                backgroundColor: '#f3f4f6',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 15,
                color: '#1f2937',
                borderWidth: selectedVenue ? 1.5 : 0,
                borderColor: '#86efac',
              }}
            />
          </View>

          {/* Submit */}
          <View style={{ paddingHorizontal: 20 }}>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              style={{
                backgroundColor: canSubmit ? '#38B6FF' : '#d1d5db',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>
                  Suggest This Place
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
