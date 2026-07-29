import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { accountsApi, plansApi, type PlanRow } from '@/src/api/endpoints';
import { Button, ErrorText, Field } from '@/src/components/ui';
import { colors, fonts, space } from '@/src/theme/admin';

const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  password?: string;
  plan?: string;
  planPrice?: string;
};

function validateNewAccount(input: {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  plan: string;
  planPrice: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  const businessName = input.businessName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim();
  const phoneDigits = input.phone.replace(/\D/g, '');
  const price = Number(input.planPrice);

  if (!businessName) errors.businessName = 'Informe o nome do negócio.';
  if (!ownerName) errors.ownerName = 'Informe o nome do responsável.';
  if (!email) errors.email = 'Informe o e-mail.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Informe um e-mail válido.';
  if (!phoneDigits) errors.phone = 'Informe o telefone com DDD.';
  else if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = 'Telefone inválido. Use DDD + número (10 a 15 dígitos).';
  }
  if (input.password && input.password.length < PASSWORD_MIN) {
    errors.password = `A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`;
  }
  if (!input.plan.trim()) errors.plan = 'Selecione um plano.';
  if (!Number.isFinite(price) || price < 0) {
    errors.planPrice = 'Informe um preço válido.';
  }
  return errors;
}

export default function NewAccountScreen() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [tempPw, setTempPw] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    plansApi
      .list()
      .then((r) => {
        setPlans(r.plans.filter((p) => p.active));
        if (r.plans[0]) {
          setPlan(r.plans[0].name);
          setPlanPrice(String(r.plans[0].price));
        }
      })
      .catch(() => undefined);
  }, []);

  const clearField = (key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  async function onSubmit() {
    setError('');
    setTempPw('');
    setTouched(true);
    const errors = validateNewAccount({
      businessName,
      ownerName,
      email,
      phone,
      password,
      plan,
      planPrice,
    });
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    setBusy(true);
    try {
      const res = await accountsApi.create({
        businessName: businessName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        phone: phone.replace(/\D/g, ''),
        password: password || undefined,
        plan,
        planPrice: Number(planPrice),
      });
      if (res.temporaryPassword) {
        setTempPw(res.temporaryPassword);
        setCreatedId(res.account.id);
      } else
        router.replace({
          pathname: '/edit-account',
          params: { id: res.account.id },
        });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Nova conta</Text>
      <Field
        label="Negócio"
        value={businessName}
        onChangeText={(t) => {
          setBusinessName(t);
          clearField('businessName');
        }}
        error={touched ? fieldErrors.businessName : undefined}
      />
      <Field
        label="Responsável"
        value={ownerName}
        onChangeText={(t) => {
          setOwnerName(t);
          clearField('ownerName');
        }}
        error={touched ? fieldErrors.ownerName : undefined}
      />
      <Field
        label="E-mail"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clearField('email');
        }}
        error={touched ? fieldErrors.email : undefined}
      />
      <Field
        label="Telefone"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => {
          setPhone(t);
          clearField('phone');
        }}
        error={touched ? fieldErrors.phone : undefined}
      />
      <Field
        label="Senha (opcional — gera temporária se vazio)"
        secureTextEntry
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clearField('password');
        }}
        error={touched ? fieldErrors.password : undefined}
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
              clearField('plan');
              clearField('planPrice');
            }}
          />
        ))}
      </View>
      <ErrorText>{touched ? fieldErrors.plan : undefined}</ErrorText>
      <Field
        label="Preço (R$)"
        keyboardType="decimal-pad"
        value={planPrice}
        onChangeText={(t) => {
          setPlanPrice(t);
          clearField('planPrice');
        }}
        error={touched ? fieldErrors.planPrice : undefined}
      />
      <ErrorText>{error}</ErrorText>
      {tempPw ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Conta criada</Text>
          <Text style={styles.noticeBody}>Senha temporária: {tempPw}</Text>
          <Button
            title="Ver conta"
            onPress={() =>
              router.replace({
                pathname: '/edit-account',
                params: { id: createdId },
              })
            }
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
          <Button title="Criar" onPress={onSubmit} loading={busy} />
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  notice: {
    backgroundColor: colors.accentSoft,
    padding: space.md,
    borderRadius: 12,
    gap: space.sm,
  },
  noticeTitle: { fontFamily: fonts.display, color: colors.ink },
  noticeBody: { fontFamily: fonts.body, color: colors.ink },
});
