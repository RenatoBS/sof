import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav } from '@/src/components/MarketingNav';
import { Button } from '@/src/components/ui';
import { marketingColors } from '@/src/theme/marketing';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.page}>
      <MarketingNav active="home" />
      <View style={styles.hero}>
        <Text style={styles.kicker}>Agendamento leve pelo WhatsApp</Text>
        <Text style={styles.title}>
          Seu salão com agenda organizada e clientes marcando pelo zap.
        </Text>
        <Text style={styles.sub}>
          Site, checkout e painel em um só lugar — confirmações em tempo real.
        </Text>
        <View style={styles.actions}>
          <Button title="Ver planos" onPress={() => router.push('/pricing')} variant="accent" />
          <Button title="Como funciona" onPress={() => router.push('/about')} variant="ghost" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: marketingColors.paper },
  hero: { padding: 24, gap: 16, maxWidth: 720, alignSelf: 'center', width: '100%' },
  kicker: { color: marketingColors.accent, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '700', color: marketingColors.ink, lineHeight: 38 },
  sub: { color: marketingColors.muted, fontSize: 16, lineHeight: 24 },
  actions: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
});
