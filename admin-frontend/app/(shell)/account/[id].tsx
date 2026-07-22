import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import {
  accountsApi,
  plansApi,
  type AccountRow,
  type PlanRow,
} from '@/src/api/endpoints';
import { Button, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

function paramId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

export default function AccountDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramId(params.id);
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [stats, setStats] = useState({ employees: 0, appointments: 0 });
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plan, setPlan] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [detail, planList] = await Promise.all([
      accountsApi.get(id),
      plansApi.list(),
    ]);
    setAccount(detail.account);
    setStats(detail.stats);
    setPlans(planList.plans);
    setBusinessName(detail.account.businessName);
    setOwnerName(detail.account.ownerName);
    setEmail(detail.account.email);
    setPhone(detail.account.phone || '');
    setPlan(detail.account.plan);
    setPlanPrice(String(detail.account.planPrice));
    setStatus(detail.account.status);
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
      const res = await accountsApi.update(id, {
        businessName,
        ownerName,
        email,
        phone: phone.replace(/\D/g, ''),
        plan,
        planPrice: Number(planPrice),
        status,
      });
      setAccount(res.account);
      setMessage('Salvo.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await accountsApi.resetPassword(id);
      setMessage(`Nova senha temporária: ${res.temporaryPassword}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao resetar senha.');
    } finally {
      setBusy(false);
    }
  }

  if (!account && !error) {
    return <Text style={{ color: colors.muted }}>Carregando…</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Button title="← Contas" variant="ghost" onPress={() => router.back()} />
      <Text style={styles.title}>{account?.businessName || 'Conta'}</Text>
      <Text style={styles.sub}>
        {stats.employees} profissionais · {stats.appointments} agendamentos
        {account?.whatsappConnected ? ' · WhatsApp conectado' : ''}
      </Text>

      <Field label="Negócio" value={businessName} onChangeText={setBusinessName} />
      <Field label="Responsável" value={ownerName} onChangeText={setOwnerName} />
      <Field
        label="E-mail"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Telefone"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Text style={styles.label}>Plano</Text>
      <View style={styles.chips}>
        {plans.map((p) => (
          <Button
            key={p.id}
            title={p.name}
            variant={plan === p.name ? 'primary' : 'ghost'}
            onPress={() => {
              setPlan(p.name);
              setPlanPrice(String(p.price));
            }}
          />
        ))}
      </View>
      <Field
        label="Preço (R$)"
        keyboardType="decimal-pad"
        value={planPrice}
        onChangeText={setPlanPrice}
      />
      <Text style={styles.label}>Status</Text>
      <View style={styles.chips}>
        <Button
          title="active"
          variant={status === 'active' ? 'primary' : 'ghost'}
          onPress={() => setStatus('active')}
        />
        <Button
          title="suspended"
          variant={status === 'suspended' ? 'primary' : 'ghost'}
          onPress={() => setStatus('suspended')}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.ok}>{message}</Text> : null}

      <View style={styles.actions}>
        <Button title="Resetar senha" variant="danger" onPress={resetPassword} disabled={busy} />
        <Button title={busy ? 'Salvando…' : 'Salvar'} onPress={save} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 560, gap: 0 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
    marginTop: space.md,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginBottom: space.lg,
    marginTop: 4,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  error: { color: colors.danger, marginBottom: space.sm },
  ok: { color: colors.accent, marginBottom: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' },
});
