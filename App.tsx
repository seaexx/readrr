import './global.css';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import LoadingSpinner from './src/components/LoadingSpinner';
import { useAppFonts } from './src/theme/fonts';
import { restoreColorScheme } from './src/theme/colorSchemePreference';

export default function App() {
  const fontsReady = useAppFonts();
  // Apply the saved light/dark/system choice before the first paint, so a
  // saved override never flashes the wrong scheme on cold open.
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    restoreColorScheme().finally(() => setThemeReady(true));
  }, []);

  return (
    // initialWindowMetrics gives screens the real safe-area insets on their very
    // first frame; without it they render at 0 and then shift down into place.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {fontsReady && themeReady ? <RootNavigator /> : <LoadingSpinner fullScreen />}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
