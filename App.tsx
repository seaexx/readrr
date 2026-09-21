import './global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import LoadingSpinner from './src/components/LoadingSpinner';
import { useAppFonts } from './src/theme/fonts';

export default function App() {
  const fontsReady = useAppFonts();

  return (
    <SafeAreaProvider>
      {fontsReady ? <RootNavigator /> : <LoadingSpinner fullScreen />}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
