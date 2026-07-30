import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { Eyebrow, Wrap } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

const VALUES = [
  {
    k: 'Leveza',
    v: 'Cada tela existe por um motivo. O que não ajuda, sai.',
  },
  {
    k: 'Confiança',
    v: 'Seus dados e os dos seus clientes ficam guardados com cuidado.',
  },
  {
    k: 'Proximidade',
    v: 'Time pequeno, resposta rápida, decisão de gente que escuta.',
  },
];

export default function AboutScreen() {
  const { width } = useWindowDimensions();
  const twoCol = width >= 800;

  return (
    <ScrollView style={styles.page}>
      <MarketingNav active="about" />
      <View style={styles.section}>
        <Wrap>
          <View style={[styles.grid, !twoCol && { flexDirection: 'column' }]}>
            <View style={{ flex: 1, gap: 16 }}>
              <Eyebrow>Quem somos</Eyebrow>
              <Text style={styles.lead}>
                A Sof nasceu de uma ideia simples: bom software não deveria pedir
                esforço de quem usa.
              </Text>
            </View>
            <View style={{ flex: 1, gap: 18 }}>
              <Text style={styles.body}>
                A gente cansou de ver negócios perdendo tempo com sistema
                complicado, planilha solta e caderninho de horário. A tecnologia de
                agendamento sempre existiu, mas quase nunca foi feita pensando em quem
                atende o cliente de verdade.
              </Text>
              <Text style={styles.body}>
                Então construímos o oposto: uma ferramenta leve, que a pessoa aprende
                sozinha no primeiro dia, e que trabalha em silêncio enquanto você faz o
                que sabe fazer.
              </Text>
              <View style={styles.values}>
                {VALUES.map((row) => (
                  <View key={row.k} style={styles.valueRow}>
                    <Text style={styles.k}>{row.k}</Text>
                    <Text style={styles.v}>{row.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </Wrap>
      </View>
      <SiteFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: m.paper },
  section: { paddingTop: 80, paddingBottom: 64 },
  grid: { flexDirection: 'row', gap: 64 },
  lead: {
    fontFamily: m.fonts.display,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: m.ink,
  },
  body: { color: m.muted, fontSize: 15, lineHeight: 24 },
  values: { marginTop: 8 },
  valueRow: {
    flexDirection: 'row',
    gap: 18,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderTopColor: m.line,
  },
  k: {
    fontFamily: m.fonts.display,
    fontSize: 16,
    minWidth: 120,
    color: m.ink,
  },
  v: { flex: 1, color: m.muted, fontSize: 15, lineHeight: 22 },
});
