// Typography for Readrr.
//
// Fraunces (a warm display serif) is used for titles, book names, and
// section headers — it gives the app an editorial, "made for readers"
// feel. Body text and UI labels stay on the system sans-serif.
//
// Brand palette stays blue + white; only the type and layout changed.
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';

export const fonts = {
  serifRegular: 'Fraunces_400Regular',
  serifMedium: 'Fraunces_500Medium',
  serifSemiBold: 'Fraunces_600SemiBold',
  serifBold: 'Fraunces_700Bold',
} as const;

// Brand + neutral tokens, centralised so a future palette tweak is one edit.
export const colors = {
  primary: '#38B6FF',
  ink: '#111827',
  muted: '#6b7280',
  hairline: '#f3f4f6',
} as const;

// Load the serif once at app start. Returns true when the app may render:
// on success OR on failure (so a font hiccup never bricks the app — text
// simply falls back to the system font).
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });
  return loaded || !!error;
}
