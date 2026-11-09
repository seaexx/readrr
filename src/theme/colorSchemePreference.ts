// Persists the user's manual light/dark/system choice across app restarts.
// NativeWind's colorScheme.set() only lives in memory, so without this the
// app would always re-open following the OS scheme, ignoring any override.
import { colorScheme } from 'nativewind';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme_preference';

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export async function getThemePreference(): Promise<ThemePreference> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (isThemePreference(saved)) return saved;
  } catch {
    // Fall through to the default below.
  }
  return 'system';
}

// Call once at app start, before the first render, so the saved preference
// is applied before anything paints (avoids a light/dark flash).
export async function restoreColorScheme(): Promise<void> {
  const pref = await getThemePreference();
  colorScheme.set(pref);
}

export async function setThemePreference(pref: ThemePreference): Promise<void> {
  colorScheme.set(pref);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Best-effort; the in-memory scheme is already updated for this session.
  }
}
