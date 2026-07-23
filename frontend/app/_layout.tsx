import {
  HankenGrotesk_400Regular,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { EmployeeAuthProvider } from '@/src/auth/EmployeeAuthProvider';
import { ToastProvider, useToast } from '@/src/context/ToastContext';
import { m } from '@/src/theme/marketing';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  const [loaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <EmployeeAuthProvider>
        <ToastProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: m.paper },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="pricing" />
            <Stack.Screen name="about" />
            <Stack.Screen name="login" />
            <Stack.Screen name="profissional/login" />
            <Stack.Screen name="profissional/definir-senha" />
            <Stack.Screen name="checkout-return" />
            <Stack.Screen name="(dashboard)" />
            <Stack.Screen name="(profissional)" />
          </Stack>
          <ToastBanner />
        </ToastProvider>
      </EmployeeAuthProvider>
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
    right: 24,
    backgroundColor: '#1a202c',
    paddingVertical: 14,
    paddingHorizontal: 19,
    borderRadius: 8,
    maxWidth: 320,
    zIndex: 999,
  },
  toastText: { color: '#fff', fontSize: 14 },
});
