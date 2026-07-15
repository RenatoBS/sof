import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { ToastProvider, useToast } from '@/src/context/ToastContext';
import { marketingColors } from '@/src/theme/marketing';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="pricing" />
          <Stack.Screen name="about" />
          <Stack.Screen name="login" />
          <Stack.Screen name="checkout-return" />
          <Stack.Screen name="(dashboard)" />
        </Stack>
        <ToastBanner />
      </ToastProvider>
    </AuthProvider>
  );
}

function ToastBanner() {
  const { message } = useToast();
  if (!message) return null;
  return (
    <View style={styles.toast}>
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: marketingColors.ink,
    padding: 14,
    borderRadius: 10,
    zIndex: 999,
  },
  toastText: { color: '#fff', textAlign: 'center' },
});
