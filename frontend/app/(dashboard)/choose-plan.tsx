import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { billingApi, plansApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

type PlanOption = { name: string; price: number; features: string[] };

export default function ChoosePlanScreen() {
  const { account, setSession, refreshMe } = useAuth();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const expired = Boolean(account?.needsPlanSelection);

  useEffect(() => {
    let cancelled = false;
    plansApi
      .list()
      .then((res) => {
        if (!cancelled && res.plans?.length) {
          setPlans(res.plans);
          setSelected(res.plans[0]?.name ?? null);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyCoupon = async () => {
    setError('');
    const code = couponCode.trim();
    if (!code) {
      setError('Informe o código do cupom.');
      return;
    }
    setBusy(true);
    try {
      const res = await billingApi.redeemCoupon(code);
      await setSession(res.account);
      router.replace('/(dashboard)/agenda');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cupom inválido.');
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async (planName: string) => {
    setError('');
    setBusy(true);
    try {
      const data = await billingApi.checkout(planName);
      if (data.mode === 'redirect' && data.initPoint) {
        if (Platform.OS === 'web') window.location.href = data.initPoint;
        else await Linking.openURL(data.initPoint);
        return;
      }
      if (data.account) {
        await setSession(data.account);
      } else {
        await refreshMe();
      }
      router.replace('/(dashboard)/agenda');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no pagamento.');
      setBusy(false);
    }
  };

  if (!account) return null;

  return (
    <View style={styles.page}>
      <Text style={styles.h2}>
        {expired ? 'Seu período grátis acabou' : 'Alterar plano'}
      </Text>
      <Text style={styles.sub}>
        {expired
          ? 'Escolha um plano para continuar usando a Sof, ou aplique um novo cupom promocional.'
          : 'Selecione o novo plano. Você será direcionado ao pagamento seguro do Stripe.'}
      </Text>

      {account.plan ? (
        <Text style={styles.current}>
          Plano atual: {account.plan}
          {account.billingSource === 'promo' && account.promoExpiresAt
            ? ` · promo até ${new Date(account.promoExpiresAt).toLocaleDateString('pt-BR')}`
            : ''}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cupom promocional</Text>
        <SofInput
          label="Código"
          value={couponCode}
          onChangeText={(t) => setCouponCode(t.toUpperCase())}
          theme="dashboard"
          placeholder="Ex: SOF30"
          autoCapitalize="characters"
        />
        <SofButton
          title={busy ? 'Aplicando…' : 'Aplicar cupom'}
          variant="dark"
          theme="dashboard"
          disabled={busy}
          onPress={applyCoupon}
        />
      </View>

      <Text style={styles.cardTitle}>Ou assinar um plano</Text>
      {loading ? (
        <ActivityIndicator color={d.muted} />
      ) : (
        plans.map((plan) => {
          const on = selected === plan.name;
          return (
            <Pressable
              key={plan.name}
              style={[styles.planRow, on && styles.planRowOn]}
              onPress={() => setSelected(plan.name)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planMeta}>
                  R$ {plan.price}
                  <Text style={styles.per}> / mês</Text>
                </Text>
              </View>
              <SofButton
                title={busy && on ? '…' : 'Assinar'}
                variant="accent"
                theme="dashboard"
                disabled={busy}
                onPress={() => subscribe(plan.name)}
              />
            </Pressable>
          );
        })
      )}

      {!expired ? (
        <SofButton
          title="Cancelar"
          variant="light"
          theme="dashboard"
          onPress={() => router.back()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 24,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 48,
  },
  h2: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: d.ink,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    color: d.muted,
    marginTop: -8,
  },
  current: {
    fontFamily: 'Inter_500Medium',
    color: d.ink,
    fontSize: 14,
  },
  error: {
    fontFamily: 'Inter_400Regular',
    color: d.danger,
  },
  card: {
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 16,
    color: d.ink,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 12,
    padding: 16,
  },
  planRowOn: {
    borderColor: d.accent,
  },
  planName: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 18,
    color: d.ink,
  },
  planMeta: {
    fontFamily: 'Inter_500Medium',
    color: d.ink,
    marginTop: 4,
  },
  per: {
    fontFamily: 'Inter_400Regular',
    color: d.muted,
    fontSize: 13,
  },
});
