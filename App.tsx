import './global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import LoadingSpinner from './src/components/LoadingSpinner';
import { useAppFonts } from './src/theme/fonts';

export default function App() {
  const fontsReady = useAppFonts();

  return (
    // initialWindowMetrics gives screens the real safe-area insets on their very
    // first frame; without it they render at 0 and then shift down into place.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      {fontsReady ? <RootNavigator /> : <LoadingSpinner fullScreen />}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
