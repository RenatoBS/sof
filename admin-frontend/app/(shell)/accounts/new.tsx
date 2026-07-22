import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { accountsApi, plansApi, type PlanRow } from '@/src/api/endpoints';
import { Button, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

export default function NewAccountScreen() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [error, setError] = useState('');
  const [tempPw, setTempPw] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    plansApi.list().then((r) => {
      setPlans(r.plans.filter((p) => p.active));
      if (r.plans[0]) {
        setPlan(r.plans[0].name);
        setPlanPrice(String(r.plans[0].price));
      }
    }).catch(() => undefined);
  }, []);

  async function onSubmit() {
    setError('');
    setTempPw('');
    setBusy(true);
    try {
      const res = await accountsApi.create({
        businessName,
        ownerName,
        email,
        phone: phone.replace(/\D/g, ''),
        password: password || undefined,
        plan,
        planPrice: Number(planPrice),
      });
      if (res.temporaryPassword) {
        setTempPw(res.temporaryPassword);
        setCreatedId(res.account.id);
      } else router.replace(`/account/${res.account.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Nova conta</Text>
      <Field label="Negócio" value={businessName} onChangeText={setBusinessName} />
      <Field label="Responsável" value={ownerName} onChangeText={setOwnerName} />
      <Field
        label="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Telefone"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Field
        label="Senha (opcional — gera temporária se vazio)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Text style={styles.label}>Plano</Text>
      <View style={styles.chips}>
        {plans.map((p) => (
          <Button
            key={p.id}
            title={`${p.name} · R$ ${p.price}`}
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tempPw ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Conta criada</Text>
          <Text style={styles.noticeBody}>Senha temporária: {tempPw}</Text>
          <Button
            title="Ver conta"
            onPress={() => router.replace(`/account/${createdId}`)}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
          <Button title={busy ? 'Salvando…' : 'Criar'} onPress={onSubmit} disabled={busy} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 560 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    marginBottom: space.lg,
    color: colors.ink,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  error: { color: colors.danger, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  notice: {
    backgroundColor: colors.accentSoft,
    padding: space.md,
    borderRadius: 12,
    gap: space.sm,
  },
  noticeTitle: { fontFamily: 'HankenGrotesk_600SemiBold', color: colors.ink },
  noticeBody: { fontFamily: 'Inter_400Regular', color: colors.ink },
});
