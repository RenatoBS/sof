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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider } from '@/src/auth/AuthProvider';
import { EmployeeAuthProvider } from '@/src/auth/EmployeeAuthProvider';
import { ToastProvider, useToast } from '@/src/context/ToastContext';
import { m } from '@/src/theme/marketing';
import { d } from '@/src/theme/dashboard';

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
            <Stack.Screen name="employee/login" />
            <Stack.Screen name="employee/set-password" />
            <Stack.Screen name="checkout-return" />
            <Stack.Screen name="(dashboard)" />
            <Stack.Screen name="(employee)" />
          </Stack>
          <ToastBanner />
        </ToastProvider>
      </EmployeeAuthProvider>
    </AuthProvider>
  );
}

function ToastBanner() {
  const { message, clearToast } = useToast();
  if (!message) return null;
  return (
    <Pressable
      onPress={clearToast}
      accessibilityRole="button"
      accessibilityLabel="Fechar notificação"
      style={({ pressed }) => [styles.toast, pressed && { opacity: 0.9 }]}
    >
      <Text style={styles.toastText}>{message}</Text>
      <Text style={styles.toastDismiss}>Fechar</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    left: 24,
    maxWidth: 360,
    marginLeft: 'auto',
    backgroundColor: d.ink,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: d.radiusSm,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...d.shadow.soft,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: d.fonts.body,
    flex: 1,
    lineHeight: 20,
  },
  toastDismiss: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontFamily: d.fonts.bodyMedium,
  },
});
