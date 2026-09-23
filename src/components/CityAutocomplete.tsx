import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { MapPin, X } from 'phosphor-react-native';
import { searchCities, cityDisplayName, CityResult } from '../services/placesService';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (city: CityResult) => void;
}

// Type-ahead city field. Free text is still allowed; picking a suggestion
// also hands back the city's coordinates.
export default function CityAutocomplete({ value, onChangeText, onSelect }: Props) {
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);
  // Skip the search that would otherwise fire right after picking a suggestion.
  const justPickedRef = useRef(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    if (!focused || value.trim().length < 2) {
      setResults([]);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchCities(value);
      // Ignore responses for an older query
      if (requestId === requestIdRef.current) {
        setResults(found);
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value, focused]);

  const handlePick = (c: CityResult) => {
    justPickedRef.current = cityDisplayName(c) !== value;
    requestIdRef.current++;
    setResults([]);
    setSearching(false);
    onSelect(c);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={styles.inputRow}>
        <MapPin size={18} color="#9ca3af" weight="duotone" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Start typing your city"
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={100}
          autoCorrect={false}
          style={{ flex: 1, fontSize: 16 }}
        />
        {searching ? (
          <ActivityIndicator size="small" color="#38B6FF" />
        ) : value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={8}>
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {results.length > 0 && (
        <View style={styles.dropdown}>
          {results.map((c, i) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => handlePick(c)}
              style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: '#f3f4f6' }]}
            >
              <Text style={{ fontSize: 15, color: '#1a1a1a' }}>{cityDisplayName(c)}</Text>
              {c.region && <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 1 }}>{c.region}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  dropdown: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
