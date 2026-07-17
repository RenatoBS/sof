import { useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { checkoutApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { setToken } from '@/src/auth/tokenStorage';
import { FeatureIcon } from '@/src/components/FeatureIcon';
import { SofButton, SofInput } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

const PASSWORD_MIN = 8;

export const PLANS = [
  {
    name: 'Essencial',
    price: 99,
    desc: 'Para quem está começando.',
    featured: false,
    features: [
      'Até 3 profissionais',
      '1 número de WhatsApp',
      'Agendamentos ilimitados',
      'Painel de agenda',
      'Suporte por e-mail',
    ],
  },
  {
    name: 'Estúdio',
    price: 197,
    desc: 'Para equipes que já giram.',
    featured: true,
    features: [
      'Até 7 profissionais',
      '2 números de WhatsApp',
      'Lembrete por SMS',
      'Relatório de faturamento',
      'Suporte prioritário',
    ],
  },
  {
    name: 'Rede',
    price: 249,
    desc: 'Para várias unidades.',
    featured: false,
    features: [
      'A partir de 8 profissionais',
      'Vários números de WhatsApp',
      'Relatório por unidade',
      'Integrações sob medida',
      'Suporte dedicado',
    ],
  },
] as const;

export function PricingCards({
  onSelect,
}: {
  onSelect: (plan: (typeof PLANS)[number]) => void;
}) {
  const { width } = useWindowDimensions();
  const stacked = width < 900;

  return (
    <View style={[styles.grid, stacked && { flexDirection: 'column' }]}>
      {PLANS.map((plan) => (
        <View
          key={plan.name}
          style={[
            styles.plan,
            plan.featured && styles.featured,
            plan.featured && m.shadow.lift,
            { flex: stacked ? undefined : 1 },
          ]}
        >
          {plan.featured ? <Text style={styles.tag}>Mais escolhido</Text> : null}
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planDesc}>{plan.desc}</Text>
          <Text style={styles.price}>
            R$ {plan.price}
            <Text style={styles.per}> / mês</Text>
          </Text>
          <View style={styles.list}>
            {plan.features.map((f) => (
              <View key={f} style={styles.liRow}>
                <FeatureIcon name="check" />
                <Text style={styles.li}>{f}</Text>
              </View>
            ))}
          </View>
          <SofButton
            title={`Assinar ${plan.name}`}
            variant={plan.featured ? 'accent' : 'solid'}
            block
            onPress={() => onSelect(plan)}
          />
        </View>
      ))}
    </View>
  );
}

export function CheckoutModal({
  visible,
  planName,
  price,
  onClose,
}: {
  visible: boolean;
  planName: string;
  price: number;
  onClose: () => void;
}) {
  const { refreshMe } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    Boolean(name.trim()) &&
    Boolean(email.trim()) &&
    password.length >= PASSWORD_MIN;

  const reset = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const enterAgenda = async (token: string) => {
    await setToken(token);
    await refreshMe();
    handleClose();
    router.replace('/(dashboard)/agenda');
  };

  const submit = async () => {
    setError('');
    if (password.length < PASSWORD_MIN) {
      setError(`A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`);
      return;
    }
    setLoading(true);
    try {
      const data = await checkoutApi.create(
        planName,
        name.trim(),
        email.trim(),
        password,
      );
      if (data.mode === 'redirect' && data.initPoint) {
        if (Platform.OS === 'web') window.location.href = data.initPoint;
        else await Linking.openURL(data.initPoint);
        return;
      }
      if (data.token) {
        await enterAgenda(data.token);
        return;
      }
      setError('Não foi possível concluir a assinatura. Tente novamente.');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no checkout');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.overlayScroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={[styles.modalCard, m.shadow.lift]}>
          <View style={styles.modalTop}>
            <Text style={styles.modalTitle}>Finalizar assinatura</Text>
            <Pressable onPress={handleClose}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Plano {planName}</Text>
              <Text>R$ {price.toFixed(2).replace('.', ',')}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={{ color: m.muted }}>Cobrança mensal</Text>
              <Text style={{ color: m.muted }}>renovação automática</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.total}>Total hoje</Text>
              <Text style={styles.total}>
                R$ {price.toFixed(2).replace('.', ',')}
              </Text>
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <SofInput
            label="Nome completo"
            value={name}
            onChangeText={setName}
            placeholder="Nome do responsável pela conta"
            autoCapitalize="words"
          />
          <SofInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="Onde você acessa o painel"
          />
          <SofInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <SofButton
            title={loading ? 'Processando…' : 'Continuar para o pagamento'}
            variant="accent"
            block
            disabled={loading || !canSubmit}
            onPress={submit}
          />
          <Text style={styles.payNote}>
            Você será direcionado ao ambiente seguro do Stripe para concluir o
            pagamento. Depois, entra direto na agenda.
          </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  plan: {
    backgroundColor: m.surface,
    borderWidth: 1,
    borderColor: m.line,
    borderRadius: m.radius,
    paddingVertical: 32,
    paddingHorizontal: 28,
  },
  featured: { borderColor: m.accent },
  tag: {
    alignSelf: 'flex-start',
    fontFamily: m.fonts.display,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: m.accentInk,
    backgroundColor: m.accentSoft,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 16,
    overflow: 'hidden',
  },
  planName: {
    fontFamily: m.fonts.display,
    fontSize: 21,
    color: m.ink,
    marginBottom: 6,
  },
  planDesc: { color: m.muted, fontSize: 15, marginBottom: 20 },
  price: {
    fontFamily: m.fonts.displayBold,
    fontSize: 42,
    letterSpacing: -1,
    color: m.ink,
  },
  per: {
    fontFamily: m.fonts.body,
    fontSize: 15,
    fontWeight: '400',
    color: m.muted,
  },
  list: { marginVertical: 24, gap: 10 },
  liRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  li: { fontSize: 15, color: m.ink, lineHeight: 22, flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(35,35,41,0.45)',
  },
  overlayScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: m.surface,
    borderRadius: m.radius,
    padding: 28,
    width: '100%',
    maxWidth: 440,
  },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: m.fonts.display,
    fontSize: 22,
    color: m.ink,
  },
  close: { fontSize: 28, color: m.muted, lineHeight: 28 },
  summary: {
    backgroundColor: m.paper,
    borderRadius: m.radiusSm,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: m.line,
  },
  total: { fontWeight: '700', color: m.ink },
  error: { color: m.danger, marginBottom: 10 },
  payNote: { marginTop: 12, fontSize: 13, color: m.muted, textAlign: 'center' },
});
