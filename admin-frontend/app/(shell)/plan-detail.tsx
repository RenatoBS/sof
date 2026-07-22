import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { plansApi, type PlanRow } from '@/src/api/endpoints';
import { Button, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

function paramId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

export default function PlanDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramId(params.id);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await plansApi.list();
    const found = list.plans.find((p) => p.id === id);
    if (!found) throw new ApiError('Plano não encontrado.', 404);
    setPlan(found);
    setName(found.name);
    setPrice(String(found.price));
    setFeaturesText(found.features.join('\n'));
    setPaymentLinkUrl(found.paymentLinkUrl);
    setActive(found.active);
  }, [id]);

  useEffect(() => {
    load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar.'),
    );
  }, [load]);

  async function save() {
    if (!id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await plansApi.update(id, {
        name,
        price: Number(price),
        features: featuresText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean),
        paymentLinkUrl,
        active,
        syncStripe: true,
      });
      setPlan(res.plan);
      setMessage(
        'Salvo. Se o preço mudou, um novo Price foi criado na Stripe (o anterior foi arquivado).',
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  if (!plan && !error) {
    return <Text style={{ color: colors.muted }}>Carregando…</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Button title="← Planos" variant="ghost" onPress={() => router.back()} />
      <Text style={styles.title}>{plan?.name || 'Plano'}</Text>
      {plan ? (
        <Text style={styles.meta}>
          Product {plan.stripeProductId}
          {'\n'}
          Price {plan.stripePriceId}
        </Text>
      ) : null}

      <Field label="Nome" value={name} onChangeText={setName} />
      <Field
        label="Preço (R$)"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
      />
      <Field
        label="Features (uma por linha)"
        multiline
        value={featuresText}
        onChangeText={setFeaturesText}
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <Field
        label="Payment Link URL"
        value={paymentLinkUrl}
        onChangeText={setPaymentLinkUrl}
        autoCapitalize="none"
      />
      <View style={styles.chips}>
        <Button
          title="Ativo"
          variant={active ? 'primary' : 'ghost'}
          onPress={() => setActive(true)}
        />
        <Button
          title="Inativo"
          variant={!active ? 'primary' : 'ghost'}
          onPress={() => setActive(false)}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <Button title={busy ? 'Salvando…' : 'Salvar'} onPress={save} disabled={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 560 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
    marginTop: space.md,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 12,
    marginBottom: space.lg,
    marginTop: 4,
  },
  chips: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
  },
  error: { color: colors.danger, marginBottom: space.sm },
  ok: { color: colors.accent, marginBottom: space.md },
});
