import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { couponsApi, type CouponRow } from '@/src/api/endpoints';
import { Button, EmptyState, ErrorText, Field, ListRow } from '@/src/components/ui';
import { colors, fonts, space } from '@/src/theme/admin';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export default function EditCouponScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [coupon, setCoupon] = useState<CouponRow | null>(null);
  const [maxUses, setMaxUses] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await couponsApi.get(id);
      setCoupon(res.coupon);
      setMaxUses(String(res.coupon.maxUses));
      setNote(res.coupon.note || '');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await couponsApi.update(id, {
        maxUses: Number(maxUses),
        note,
      });
      setCoupon((prev) =>
        prev
          ? { ...res.coupon, redemptions: prev.redemptions }
          : res.coupon,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function onToggleActive() {
    if (!id || !coupon) return;
    setBusy(true);
    setError('');
    try {
      const res = await couponsApi.update(id, { active: !coupon.active });
      setCoupon((prev) =>
        prev
          ? { ...res.coupon, redemptions: prev.redemptions }
          : res.coupon,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao atualizar.');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await couponsApi.remove(id);
      router.replace('/coupons');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao desativar.');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!coupon) {
    return (
      <View style={styles.wrap}>
        <ErrorText>{error || 'Cupom não encontrado.'}</ErrorText>
        <Button title="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const redemptions = coupon.redemptions || [];

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>{coupon.code}</Text>
      <Text style={styles.meta}>
        {coupon.planName} · {coupon.freeDays} dias grátis · {coupon.usedCount}/
        {coupon.maxUses} usos · {coupon.active ? 'ativo' : 'inativo'}
      </Text>
      <Field
        label="Máximo de usos"
        keyboardType="number-pad"
        value={maxUses}
        onChangeText={setMaxUses}
      />
      <Field
        label="Nota interna"
        value={note}
        onChangeText={setNote}
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
        <Button title="Salvar" onPress={onSave} loading={busy} />
      </View>
      <View style={[styles.actions, { marginTop: space.md }]}>
        <Button
          title={coupon.active ? 'Desativar' : 'Reativar'}
          variant="ghost"
          onPress={onToggleActive}
          disabled={busy}
        />
        {coupon.active ? (
          <Button
            title="Desativar e sair"
            variant="ghost"
            onPress={onDeactivate}
            disabled={busy}
          />
        ) : null}
      </View>

      <Text style={styles.section}>Contas que usaram ({redemptions.length})</Text>
      {redemptions.length === 0 ? (
        <EmptyState message="Nenhuma conta resgatou este cupom ainda." />
      ) : (
        redemptions.map((r) => (
          <ListRow
            key={r.id}
            title={r.account.businessName || r.account.email}
            meta={`${r.account.email} · resgatado ${formatDate(r.redeemedAt)} · expira ${formatDate(r.expiresAt)} · ${r.account.billingSource}/${r.account.status}`}
            onPress={() =>
              router.push({
                pathname: '/edit-account',
                params: { id: r.account.id },
              })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { paddingBottom: 48, maxWidth: 720 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
    marginBottom: space.sm,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginBottom: space.lg,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  section: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.ink,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
});
