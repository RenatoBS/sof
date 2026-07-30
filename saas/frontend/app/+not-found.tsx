import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Wordmark } from '@/src/components/MarketingNav';
import { SofButton } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Não encontrado' }} />
      <View style={styles.container}>
        <Wordmark />
        <Text style={styles.title}>Esta página não existe.</Text>
        <Text style={styles.sub}>
          O link pode estar errado ou a página foi movida.
        </Text>
        <SofButton
          title="Voltar ao início"
          variant="accent"
          onPress={() => router.replace('/')}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 32,
    backgroundColor: m.paper,
  },
  title: {
    fontFamily: m.fonts.displayBold,
    fontSize: 24,
    color: m.ink,
    letterSpacing: -0.4,
    marginTop: 8,
  },
  sub: {
    fontFamily: m.fonts.body,
    fontSize: 15,
    color: m.muted,
    textAlign: 'center',
    marginBottom: 6,
  },
});
