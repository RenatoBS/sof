import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { ApiError } from '@/src/api/client';
import { couponsApi, type CouponRow } from '@/src/api/endpoints';
import {
  Button,
  EmptyState,
  ErrorText,
  ListRow,
  PageHeader,
} from '@/src/components/ui';
import { colors, fonts } from '@/src/theme/admin';

export default function CouponsScreen() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await couponsApi.list();
      setCoupons(res.coupons);
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
        title="Cupons promocionais"
        subtitle="Dias grátis de um plano — o cliente pula o Stripe no checkout."
        action={<Button title="Novo cupom" onPress={() => router.push('/new-coupon')} />}
      />

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : coupons.length === 0 ? (
        <EmptyState message="Nenhum cupom cadastrado." />
      ) : (
        coupons.map((item) => (
          <ListRow
            key={item.id}
            title={item.code}
            meta={`${item.planName || '—'} · ${item.freeDays} dias · ${item.usedCount}/${item.maxUses} usos${item.active ? '' : ' · inativo'}`}
            onPress={() =>
              router.push({ pathname: '/edit-coupon', params: { id: item.id } })
            }
            right={<Text style={styles.badge}>{item.remainingUses} rest.</Text>}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  badge: {
    fontFamily: fonts.bodyMedium,
    color: colors.accent,
    fontSize: 13,
  },
});
