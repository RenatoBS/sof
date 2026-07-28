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
import { couponsApi, type CouponRow } from '@/src/api/endpoints';
import { Button } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

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
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Cupons promocionais</Text>
          <Text style={styles.sub}>
            Dias grátis de um plano — o cliente pula o Stripe no checkout.
          </Text>
        </View>
        <Button title="Novo cupom" onPress={() => router.push('/new-coupon')} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : coupons.length === 0 ? (
        <Text style={styles.empty}>Nenhum cupom cadastrado.</Text>
      ) : (
        coupons.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/edit-coupon',
                params: { id: item.id },
              })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.code}</Text>
              <Text style={styles.rowMeta}>
                {item.planName || '—'} · {item.freeDays} dias ·{' '}
                {item.usedCount}/{item.maxUses} usos
                {item.active ? '' : ' · inativo'}
              </Text>
            </View>
            <Text style={styles.badge}>
              {item.remainingUses} rest.
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
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 16,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginTop: 4,
    fontSize: 13,
  },
  badge: {
    fontFamily: 'Inter_500Medium',
    color: colors.accent,
    fontSize: 13,
  },
});
