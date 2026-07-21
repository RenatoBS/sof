import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { SofChatCard } from '@/src/components/SofChatCard';
import { FeatureIcon } from '@/src/components/FeatureIcon';
import { Eyebrow, SofButton, Wrap } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

const FEATURES = [
  {
    icon: 'chat',
    title: 'Agenda pelo WhatsApp',
    body: 'O cliente marca conversando. Sem baixar app, sem criar conta, sem senha.',
  },
  {
    icon: 'calendar',
    title: 'A semana inteira numa tela',
    body: 'Todos os profissionais, os sete dias, lado a lado. Clicou, editou.',
  },
  {
    icon: 'bell',
    title: 'Lembrete automático',
    body: 'Aviso no WhatsApp antes do horário, no tempo que você configurar. Menos falta, sem ninguém precisar lembrar.',
  },
  {
    icon: 'chart',
    title: 'Faturamento sem planilha',
    body: 'Quanto entrou no dia, na semana, no mês. Já somado, já pronto.',
  },
  {
    icon: 'phone',
    title: 'Funciona no celular',
    body: 'A mesma experiência no telefone, no tablet ou no computador do balcão.',
  },
  {
    icon: 'heart',
    title: 'Suporte de gente',
    body: 'Quando algo trava, alguém responde. Sem robô, sem fila infinita.',
  },
];

const STEPS = [
  {
    num: 'Passo 01',
    title: 'Você assina',
    body: 'Escolhe um plano e cria a conta. O acesso chega na hora, aqui mesmo na tela.',
  },
  {
    num: 'Passo 02',
    title: 'A gente configura',
    body: 'Conectamos seu WhatsApp e cadastramos a equipe. Você não precisa mexer em nada técnico.',
  },
  {
    num: 'Passo 03',
    title: 'Os clientes marcam',
    body: 'Cada agendamento cai direto no painel, organizado por profissional e horário.',
  },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const twoCol = width >= 860;

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ flexGrow: 1 }}>
      <MarketingNav active="home" />

      <View style={styles.hero}>
        <Wrap>
          <View style={[styles.heroGrid, !twoCol && { flexDirection: 'column' }]}>
            <View style={styles.heroCopy}>
              <Eyebrow>Agendamento pelo WhatsApp</Eyebrow>
              <Text style={styles.h1}>
                Agendar{'\n'}devia ser leve.
              </Text>
              <Text style={styles.lead}>
                A Sof cuida da agenda do seu salão direto no WhatsApp, com um
                painel que a equipe inteira entende em segundos.
              </Text>
              <View style={styles.actions}>
                <SofButton
                  title="Ver planos"
                  variant="accent"
                  large
                  onPress={() => router.push('/pricing')}
                />
                <SofButton
                  title="Como funciona"
                  variant="ghost"
                  large
                  onPress={() => router.push('/about')}
                />
              </View>
              <Text style={styles.note}>A partir de R$ 99 por mês. Sem fidelidade.</Text>
            </View>
            <View style={{ flex: 1 }}>
              <SofChatCard />
            </View>
          </View>
        </Wrap>
      </View>

      <View style={styles.section}>
        <Wrap>
          <View style={styles.sectionHead}>
            <Eyebrow>O que a Sof faz</Eyebrow>
            <Text style={styles.h2}>Tudo o que o dia a dia pede. Nada além.</Text>
            <Text style={styles.sectionP}>
              Sem tela cheia de botão, sem manual. As coisas ficam onde você espera
              encontrar.
            </Text>
          </View>
          <View style={[styles.featureGrid, !twoCol && { flexDirection: 'column' }]}>
            {FEATURES.map((f) => (
              <View key={f.title} style={[styles.feature, m.shadow.soft]}>
                <View style={styles.mark}>
                  <FeatureIcon name={f.icon} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            ))}
          </View>
        </Wrap>
      </View>

      <View style={[styles.section, { paddingTop: 20 }]}>
        <Wrap>
          <View style={styles.sectionHead}>
            <Eyebrow>Do zero ao primeiro agendamento</Eyebrow>
            <Text style={styles.h2}>Três passos, e a agenda anda sozinha.</Text>
          </View>
          <View style={[styles.steps, !twoCol && { flexDirection: 'column' }]}>
            {STEPS.map((s) => (
              <View key={s.num} style={styles.step}>
                <View style={styles.rule}>
                  <View style={styles.ruleAccent} />
                </View>
                <Text style={styles.stepNum}>{s.num}</Text>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepBody}>{s.body}</Text>
              </View>
            ))}
          </View>
        </Wrap>
      </View>

      <SiteFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: m.paper },
  hero: { paddingTop: 64, paddingBottom: 40 },
  heroGrid: { flexDirection: 'row', gap: 56, alignItems: 'center' },
  heroCopy: { flex: 1.05, gap: 8 },
  h1: {
    fontFamily: m.fonts.display,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1,
    color: m.ink,
    marginVertical: 16,
  },
  lead: {
    fontFamily: m.fonts.body,
    fontSize: 19,
    color: m.muted,
    maxWidth: 360,
    marginBottom: 24,
    lineHeight: 28,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  note: { marginTop: 16, fontSize: 14, color: m.muted },
  section: { paddingVertical: 64 },
  sectionHead: { maxWidth: 480, marginBottom: 40, gap: 12 },
  h2: {
    fontFamily: m.fonts.display,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.7,
    color: m.ink,
  },
  sectionP: { fontSize: 17, color: m.muted, lineHeight: 26 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  feature: {
    backgroundColor: m.surface,
    borderRadius: m.radius,
    padding: 28,
    flexGrow: 1,
    flexBasis: 280,
    minWidth: 240,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: m.accentSoft,
    marginBottom: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontFamily: m.fonts.display,
    fontSize: 18,
    marginBottom: 8,
    color: m.ink,
  },
  featureBody: { color: m.muted, fontSize: 15, lineHeight: 22 },
  steps: { flexDirection: 'row', gap: 36 },
  step: { flex: 1 },
  rule: {
    height: 1,
    backgroundColor: m.line,
    marginBottom: 16,
  },
  ruleAccent: { width: 28, height: 1, backgroundColor: m.accent },
  stepNum: {
    fontFamily: m.fonts.displayBold,
    fontSize: 13,
    color: m.accentInk,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  stepTitle: {
    fontFamily: m.fonts.display,
    fontSize: 18,
    marginBottom: 8,
    color: m.ink,
  },
  stepBody: { color: m.muted, fontSize: 15, lineHeight: 22 },
});
