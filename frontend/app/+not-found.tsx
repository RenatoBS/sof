import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { m } from '@/src/theme/marketing';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Não encontrado' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Esta página não existe.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Voltar ao início</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: m.paper,
  },
  title: {
    fontFamily: m.fonts.display,
    fontSize: 22,
    color: m.ink,
  },
  link: { marginTop: 16 },
  linkText: { color: m.accentInk, fontSize: 15 },
});
