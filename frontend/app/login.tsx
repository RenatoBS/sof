import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { SofButton, SofInput } from '@/src/components/ui';
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
        router.replace('/(profissional)/trocar-senha');
      } else {
        router.replace('/(profissional)/agenda');
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
        <View style={[styles.card, m.shadow.soft]}>
          <Text style={styles.h2}>Entrar</Text>
          <Text style={styles.sub}>
            Acesse o painel do estabelecimento ou a agenda do profissional.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <SofInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="voce@salao.com"
          />
          <SofInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Sua senha"
          />
          <SofButton
            title={loading ? 'Entrando…' : 'Entrar'}
            variant="accent"
            block
            disabled={loading}
            onPress={submit}
          />
          <Text style={styles.alt}>
            Ainda não tem conta?{' '}
            <Text style={styles.altLink} onPress={() => router.push('/pricing')}>
              Ver planos
            </Text>
          </Text>
        </View>
      </View>
      <SiteFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: m.paper },
  content: { flexGrow: 1 },
  auth: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
  },
  card: {
    backgroundColor: m.surface,
    borderRadius: m.radius,
    paddingVertical: 36,
    paddingHorizontal: 32,
  },
  h2: {
    fontFamily: m.fonts.display,
    fontSize: 26,
    color: m.ink,
    marginBottom: 6,
  },
  sub: { color: m.muted, fontSize: 15, marginBottom: 28 },
  error: {
    color: m.danger,
    backgroundColor: m.dangerSoft,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  alt: { marginTop: 20, textAlign: 'center', color: m.muted, fontSize: 14 },
  altLink: { color: m.accentInk, fontWeight: '600' },
});
