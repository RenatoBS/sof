import { Stack } from 'expo-router';
import { colors } from '@/src/theme/admin';

/** Rotas públicas (sem login): /guides, /guides/onboarding, /guides/bot */
export default function GuidesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
