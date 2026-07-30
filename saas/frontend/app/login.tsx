import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { SofAuthCard, SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { ApiError } from '@/src/api/client';
import { m } from '@/src/theme/marketing';

function isEmailNotFound(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('não encontrado') || msg.includes('nao encontrado');
}

export default function LoginScreen() {
  const { login: loginAccount, logout: logoutAccount } = useAuth();
  const { login: loginEmployee, logout: logoutEmployee } = useEmployeeAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      await logoutEmployee().catch(() => undefined);

      try {
        await loginAccount(normalizedEmail, password);
        router.replace('/(dashboard)/agenda');
        return;
      } catch (accountErr) {
        if (!isEmailNotFound(accountErr)) {
          throw accountErr;
        }
      }

      await logoutAccount().catch(() => undefined);
      const emp = await loginEmployee(normalizedEmail, password);
      if (emp.mustChangePassword) {
        router.replace('/(employee)/change-password');
      } else {
        router.replace('/(employee)/agenda');
      }
    } catch (err) {
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Falha no login';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <MarketingNav active="login" />
      <View style={styles.auth}>
        <SofAuthCard
          title="Entrar"
          subtitle="Acesse o painel do estabelecimento ou a agenda do profissional."
        >
          {error ? <SofErrorBanner message={error} /> : null}
          <SofInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="voce@negocio.com"
          />
          <SofInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Sua senha"
          />
          <SofButton
            title="Entrar"
            variant="accent"
            block
            loading={loading}
            disabled={loading}
            onPress={submit}
          />
          <Text
            style={styles.forgot}
            onPress={() => router.push('/forgot-password')}
          >
            Esqueci minha senha
          </Text>
          <Text style={styles.alt}>
            Ainda não tem conta?{' '}
            <Text style={styles.altLink} onPress={() => router.push('/pricing')}>
              Ver planos
            </Text>
          </Text>
        </SofAuthCard>
      </View>
      <SiteFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: m.paper },
  content: { flexGrow: 1 },
  auth: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
  },
  forgot: {
    marginTop: 14,
    textAlign: 'center',
    color: m.accentInk,
    fontSize: 14,
    fontFamily: m.fonts.bodyMedium,
    fontWeight: '600',
  },
  alt: {
    marginTop: 20,
    textAlign: 'center',
    color: m.muted,
    fontSize: 14,
    fontFamily: m.fonts.body,
  },
  altLink: { color: m.accentInk, fontFamily: m.fonts.bodyMedium, fontWeight: '600' },
});
