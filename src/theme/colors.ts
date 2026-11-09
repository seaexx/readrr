// Dark-mode-aware neutral text/icon tones.
//
// Most of the app sets text/icon color via inline style props (not
// className), so Tailwind's `dark:` variant can't reach them — NativeWind
// only rewrites classNames. This hook gives those call sites a reactive
// value instead. The scale mirrors Tailwind's gray palette and inverts the
// same way bg-white/text-gray-900 would via `dark:`, so light and dark keep
// the same text hierarchy.
import { useColorScheme } from 'nativewind';

export interface ThemeInk {
  isDark: boolean;
  heading: string; // primary titles (was '#1a1a1a' / '#111827')
  strong: string; // gray-800 — captions, emphasized body text
  body: string; // gray-700 — counts, chip labels, body copy
  secondary: string; // gray-600 — authors, secondary labels
  muted: string; // gray-500 — timestamps, muted icons
  subtle: string; // gray-400 — placeholders, the least prominent icons
  border: string; // gray-300/gray-200 — input + card borders
  hairline: string; // gray-100 — list dividers, thin separators
  surface: string; // gray-50 — subtle card/section backgrounds
}

const LIGHT: ThemeInk = {
  isDark: false,
  heading: '#1a1a1a',
  strong: '#1f2937',
  body: '#374151',
  secondary: '#4b5563',
  muted: '#6b7280',
  subtle: '#9ca3af',
  border: '#d1d5db',
  hairline: '#f3f4f6',
  surface: '#f9fafb',
};

const DARK: ThemeInk = {
  isDark: true,
  heading: '#f9fafb',
  strong: '#f3f4f6',
  body: '#e5e7eb',
  secondary: '#d1d5db',
  muted: '#9ca3af',
  subtle: '#6b7280',
  border: '#4b5563',
  hairline: '#1f2937',
  surface: '#1f2937',
};

export function useThemeColors(): ThemeInk {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? DARK : LIGHT;
}
