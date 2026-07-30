import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { ApiError } from '@/src/api/client';
import { plansApi, type PlanRow } from '@/src/api/endpoints';
import {
  Button,
  EmptyState,
  ErrorText,
  ListRow,
  PageHeader,
} from '@/src/components/ui';
import { colors, fonts } from '@/src/theme/admin';

export default function PlansScreen() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await plansApi.list();
      setPlans(res.plans);
      setStripeConfigured(res.stripeConfigured);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <PageHeader
        title="Planos"
        subtitle={
          stripeConfigured
            ? 'Stripe conectada — criar/editar sincroniza Product/Price.'
            : 'Stripe não configurada — use IDs manuais ao criar.'
        }
        action={<Button title="Novo plano" onPress={() => router.push('/new-plan')} />}
      />

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : plans.length === 0 ? (
        <EmptyState message="Nenhum plano cadastrado." />
      ) : (
        plans.map((item) => (
          <ListRow
            key={item.id}
            title={item.name}
            meta={`${item.stripePriceId} · ${item.accountCount ?? 0} contas · ${item.active ? 'ativo' : 'inativo'}`}
            onPress={() =>
              router.push({ pathname: '/edit-plan', params: { id: item.id } })
            }
            right={
              <Text style={styles.price}>
                R$ {item.price}
                <Text style={styles.per}>
                  {' '}
                  / {item.interval === 'year' ? 'ano' : 'mês'}
                </Text>
              </Text>
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  price: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.ink,
  },
  per: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
  },
});
