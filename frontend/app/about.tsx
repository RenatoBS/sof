import { ScrollView, StyleSheet, Text } from 'react-native';
import { MarketingNav } from '@/src/components/MarketingNav';
import { marketingColors } from '@/src/theme/marketing';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.page}>
      <MarketingNav active="about" />
      <Text style={styles.title}>Quem somos</Text>
      <Text style={styles.p}>
        A Soft ajuda salões e estúdios a organizarem a agenda com um painel
        simples e um bot de WhatsApp que confirma horários automaticamente.
      </Text>
      <Text style={styles.p}>
        Você cadastra profissionais e serviços, o cliente escolhe pelo WhatsApp,
        e o agendamento aparece na hora no dashboard.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: marketingColors.paper, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: marketingColors.ink, marginBottom: 12 },
  p: { color: marketingColors.muted, lineHeight: 22, marginBottom: 12 },
});
