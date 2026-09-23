import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  onBarcodeScanned: (isbn: string) => void;
  onCancel: () => void;
  title?: string;
}

export default function BarcodeScanner({
  onBarcodeScanned,
  onCancel,
  title = 'Scan Book Barcode'
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  // Synchronous lock: the camera fires onBarcodeScanned many times/sec, faster
  // than the `scanned` state updates — a ref blocks the extra calls immediately
  // (otherwise the lookup + "not found" alert stack up several deep).
  const lockedRef = useRef(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setScanned(true);
    onBarcodeScanned(data);
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-black items-center justify-center">
        <Text className="text-white">Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-xl font-bold mb-4 text-center">Camera Permission Required</Text>
        <Text className="text-gray-600 mb-6 text-center">
          We need camera access to scan book barcodes
        </Text>
        <TouchableOpacity
          onPress={requestPermission}
          className="bg-primary py-4 px-8 rounded-xl mb-4"
        >
          <Text className="text-white font-semibold">Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text className="text-gray-500">Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1">
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8'],
        }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Overlay */}
      <SafeAreaView className="flex-1 justify-between">
        {/* Top bar */}
        <View className="bg-black/50 px-6 py-4">
          <Text className="text-white text-xl font-bold">{title}</Text>
          <Text className="text-white/80 text-sm mt-1">
            Position barcode in camera view
          </Text>
        </View>

        {/* Bottom button */}
        <View className="bg-black/50 px-6 py-6">
          <TouchableOpacity onPress={onCancel} className="py-4">
            <Text className="text-white text-center font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}
