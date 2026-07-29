import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import {
  accountsApi,
  plansApi,
  type AccountRow,
  type EntitlementsMap,
  type PlanRow,
} from '@/src/api/endpoints';
import { EntitlementsEditor } from '@/src/components/EntitlementsEditor';
import { Button, EmptyState, ErrorText, Field, ListRow } from '@/src/components/ui';
import { colors, fonts, space } from '@/src/theme/admin';

function paramId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

function confirmDelete(planName: string): Promise<boolean> {
  const message =
    `Apagar o plano “${planName}”? Isso desativa o Payment Link e remove/arquiva o produto na Stripe. Não dá para desfazer.`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert('Apagar plano', message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Apagar', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function PlanDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramId(params.id);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [featuresText, setFeaturesText] = useState('');
  const [entitlements, setEntitlements] = useState<EntitlementsMap>({});
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
    setEntitlements(found.entitlements || {});
    setPaymentLinkUrl(found.paymentLinkUrl);
    setActive(found.active);
    const acc = await accountsApi.list({ planId: id });
    setAccounts(acc.accounts);
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
        entitlements,
        paymentLinkUrl,
        active,
        syncStripe: true,
      });
      setPlan(res.plan);
      setPaymentLinkUrl(res.plan.paymentLinkUrl);
      setEntitlements(res.plan.entitlements || {});
      setMessage(
        'Salvo. Se o preço mudou, um novo Price/Payment Link foi criado na Stripe.',
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function onSyncStripe() {
    if (!id) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await plansApi.syncStripe(id);
      setPlan(res.plan);
      setPaymentLinkUrl(res.plan.paymentLinkUrl);
      setMessage('Stripe sincronizado: Product, Price e Payment Link atualizados.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao sincronizar Stripe.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!id || !plan) return;
    const ok = await confirmDelete(plan.name);
    if (!ok) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await plansApi.remove(id);
      router.replace('/plans');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao apagar.');
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
      <EntitlementsEditor value={entitlements} onChange={setEntitlements} />
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

      <ErrorText>{error}</ErrorText>
      {message ? <Text style={styles.ok}>{message}</Text> : null}
      <View style={styles.actions}>
        <Button title="Salvar" onPress={save} loading={busy} />
        <Button
          title="Sincronizar Stripe"
          variant="ghost"
          onPress={onSyncStripe}
          disabled={busy || !plan}
        />
        <Button
          title="Apagar plano"
          variant="danger"
          onPress={onDelete}
          disabled={busy || !plan}
        />
      </View>

      <Text style={styles.section}>
        Contas neste plano ({plan?.accountCount ?? accounts.length})
      </Text>
      <Button
        title="Ver na lista de Contas"
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/accounts',
            params: { planId: id, planName: plan?.name || name },
          })
        }
      />
      {accounts.length === 0 ? (
        <EmptyState message="Nenhuma conta neste plano." />
      ) : (
        accounts.map((item) => (
          <ListRow
            key={item.id}
            title={item.businessName}
            meta={`${item.email} · ${item.status}${
              item.billingSource === 'promo' ? ' · promo' : ''
            }`}
            onPress={() =>
              router.push({
                pathname: '/edit-account',
                params: { id: item.id },
              })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 720 },
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  ok: { color: colors.accent, marginBottom: space.md },
  section: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    color: colors.ink,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
});
