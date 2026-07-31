import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { colors, fonts, space } from '@/src/theme/admin';

const STATIC_PATH = '/guides/bot-whatsapp.html';

/** Rota pública → HTML estático do bot WhatsApp. */
export default function GuidesBotRedirect() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.replace(STATIC_PATH);
    }
  }, []);

  return (
    <View style={styles.root}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.text}>Abrindo guia do bot WhatsApp…</Text>
      {Platform.OS !== 'web' ? (
        <Link href={'/guides' as Href} style={styles.fallback}>
          Voltar aos guias
        </Link>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    backgroundColor: colors.bg,
    padding: space.lg,
  },
  text: { fontFamily: fonts.body, color: colors.muted, fontSize: 14 },
  fallback: {
    fontFamily: fonts.bodyMedium,
    color: colors.copper,
    marginTop: space.sm,
  },
});
