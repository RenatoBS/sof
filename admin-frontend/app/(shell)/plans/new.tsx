import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { plansApi } from '@/src/api/endpoints';
import { Button, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

export default function NewPlanScreen() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [stripeProductId, setStripeProductId] = useState('');
  const [stripePriceId, setStripePriceId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError('');
    try {
      const features = featuresText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await plansApi.create({
        name,
        price: Number(price),
        features,
        syncStripe: true,
        stripeProductId: stripeProductId || undefined,
        stripePriceId: stripePriceId || undefined,
      });
      router.replace(`/plans/${res.plan.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Novo plano</Text>
      <Text style={styles.hint}>
        Com STRIPE_SECRET_KEY, Product e Price são criados automaticamente.
        Sem Stripe, informe os IDs manuais.
      </Text>
      <Field label="Nome" value={name} onChangeText={setName} />
      <Field
        label="Preço mensal (R$)"
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
        label="stripeProductId (só sem Stripe auto)"
        value={stripeProductId}
        onChangeText={setStripeProductId}
        autoCapitalize="none"
      />
      <Field
        label="stripePriceId (só sem Stripe auto)"
        value={stripePriceId}
        onChangeText={setStripePriceId}
        autoCapitalize="none"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
        <Button title={busy ? 'Criando…' : 'Criar'} onPress={onSubmit} disabled={busy} />
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
  error: { color: colors.danger, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
});
