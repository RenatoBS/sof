import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '@/src/api/client';
import { couponsApi, plansApi, type PlanRow } from '@/src/api/endpoints';
import { Button, ErrorText, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

const FREE_DAY_OPTIONS = [7, 30, 60] as const;

export default function NewCouponScreen() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [code, setCode] = useState('');
  const [planId, setPlanId] = useState('');
  const [freeDays, setFreeDays] = useState<(typeof FREE_DAY_OPTIONS)[number]>(30);
  const [maxUses, setMaxUses] = useState('10');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    plansApi
      .list()
      .then((res) => {
        const active = res.plans.filter((p) => p.active);
        setPlans(active);
        if (active[0]) setPlanId(active[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit() {
    setBusy(true);
    setError('');
    try {
      const res = await couponsApi.create({
        code,
        planId,
        freeDays,
        maxUses: Number(maxUses),
        note: note || undefined,
      });
      router.replace({
        pathname: '/edit-coupon',
        params: { id: res.coupon.id },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Novo cupom</Text>
      <Text style={styles.hint}>
        O código libera o plano escolhido por 7, 30 ou 60 dias sem passar pelo
        Stripe. Cada conta só usa o mesmo cupom uma vez.
      </Text>
      <Field
        label="Código"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        autoCapitalize="characters"
        placeholder="EX: SOF30"
      />
      <Text style={styles.label}>Plano</Text>
      <View style={styles.chips}>
        {plans.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.chip, planId === p.id && styles.chipOn]}
            onPress={() => setPlanId(p.id)}
          >
            <Text style={[styles.chipText, planId === p.id && styles.chipTextOn]}>
              {p.name} · R$ {p.price}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Dias grátis</Text>
      <View style={styles.chips}>
        {FREE_DAY_OPTIONS.map((d) => (
          <Pressable
            key={d}
            style={[styles.chip, freeDays === d && styles.chipOn]}
            onPress={() => setFreeDays(d)}
          >
            <Text
              style={[styles.chipText, freeDays === d && styles.chipTextOn]}
            >
              {d} dias
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Máximo de usos"
        keyboardType="number-pad"
        value={maxUses}
        onChangeText={setMaxUses}
      />
      <Field
        label="Nota interna (opcional)"
        value={note}
        onChangeText={setNote}
        placeholder="Campanha, parceiro…"
      />
      <ErrorText>{error}</ErrorText>
      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
        <Button
          title="Criar"
          onPress={onSubmit}
          loading={busy}
          disabled={!code.trim() || !planId}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 560 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
    marginBottom: space.sm,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginBottom: space.lg,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
    marginBottom: space.sm,
    marginTop: space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontFamily: 'Inter_500Medium', color: colors.muted, fontSize: 13 },
  chipTextOn: { color: colors.accent },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
