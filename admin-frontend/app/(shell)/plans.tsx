import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '@/src/api/client';
import { plansApi, type PlanRow } from '@/src/api/endpoints';
import { Button } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

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
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Planos</Text>
          <Text style={styles.sub}>
            {stripeConfigured
              ? 'Stripe conectada — criar/editar sincroniza Product/Price.'
              : 'Stripe não configurada — use IDs manuais ao criar.'}
          </Text>
        </View>
        <Button title="Novo plano" onPress={() => router.push('/new-plan')} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : plans.length === 0 ? (
        <Text style={styles.empty}>Nenhum plano cadastrado.</Text>
      ) : (
        plans.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() =>
              router.push({ pathname: '/edit-plan', params: { id: item.id } })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.stripePriceId} · {item.active ? 'ativo' : 'inativo'}
              </Text>
            </View>
            <Text style={styles.price}>
              R$ {item.price}
              <Text style={styles.per}>
                {' '}
                / {item.interval === 'year' ? 'ano' : 'mês'}
              </Text>
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.lg,
    gap: space.md,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginTop: 4,
    maxWidth: 480,
  },
  error: { color: colors.danger, marginBottom: space.sm },
  empty: { color: colors.muted, marginTop: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: space.md,
    gap: space.md,
    marginBottom: space.sm,
  },
  rowTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 16,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  price: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 18,
    color: colors.ink,
  },
  per: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: colors.muted,
  },
});
