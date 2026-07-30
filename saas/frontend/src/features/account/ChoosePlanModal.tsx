import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { billingApi, plansApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import { d } from '@/src/theme/dashboard';

type PlanOption = { name: string; price: number; features: string[] };

type ChoosePlanModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ChoosePlanModal({ visible, onClose }: ChoosePlanModalProps) {
  const { account, setSession, refreshMe } = useAuth();
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCouponCode('');
    setError('');
    setBusy(false);
    setLoading(true);
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
  }, [visible]);

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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cupom inválido.');
    } finally {
      setBusy(false);
    }
  };

  const subscribe = async (planName: string) => {
    setError('');
    setBusy(true);
    setSelected(planName);
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no pagamento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title="Alterar plano"
      hint="Selecione o novo plano ou aplique um cupom. Pagamentos seguem para o Stripe."
      actions={
        <SofButton
          title="Cancelar"
          variant="light"
          theme="dashboard"
          disabled={busy}
          onPress={onClose}
        />
      }
    >
      {account?.plan ? (
        <Text style={styles.current}>
          Plano atual: {account.plan}
          {account.billingSource === 'promo' && account.promoExpiresAt
            ? ` · promo até ${new Date(account.promoExpiresAt).toLocaleDateString('pt-BR')}`
            : ''}
        </Text>
      ) : null}

      {error ? <SofErrorBanner message={error} /> : null}

      <View style={styles.block}>
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
          title="Aplicar cupom"
          variant="dark"
          theme="dashboard"
          loading={busy}
          disabled={busy}
          onPress={applyCoupon}
        />
      </View>

      <Text style={styles.sectionTitle}>Ou assinar um plano</Text>
      {loading ? (
        <ActivityIndicator color={d.muted} />
      ) : (
        <View style={styles.plans}>
          {plans.map((plan) => {
            const on = selected === plan.name;
            return (
              <View
                key={plan.name}
                style={[styles.planRow, on && styles.planRowOn]}
              >
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planMeta}>
                    R$ {plan.price}
                    <Text style={styles.per}> / mês</Text>
                  </Text>
                </View>
                <SofButton
                  title="Assinar"
                  variant="accent"
                  theme="dashboard"
                  loading={busy && on}
                  disabled={busy}
                  onPress={() => subscribe(plan.name)}
                />
              </View>
            );
          })}
        </View>
      )}
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  current: {
    fontFamily: d.fonts.bodyMedium,
    color: d.ink,
    fontSize: 14,
    marginBottom: 4,
  },
  block: { gap: 10 },
  cardTitle: {
    fontFamily: d.fonts.displayBold,
    fontSize: 16,
    color: d.ink,
  },
  sectionTitle: {
    fontFamily: d.fonts.displayBold,
    fontSize: 16,
    color: d.ink,
    marginTop: 8,
  },
  plans: { gap: 12 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radius,
    padding: 16,
  },
  planRowOn: {
    borderColor: d.accent,
  },
  planInfo: { flex: 1, minWidth: 0 },
  planName: {
    fontFamily: d.fonts.displayBold,
    fontSize: 17,
    color: d.ink,
  },
  planMeta: {
    fontFamily: d.fonts.bodyMedium,
    color: d.ink,
    marginTop: 4,
  },
  per: {
    fontFamily: d.fonts.body,
    color: d.muted,
    fontSize: 13,
  },
});
