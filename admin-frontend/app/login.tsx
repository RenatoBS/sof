import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ApiError } from '@/src/api/client';
import { useAdminAuth } from '@/src/auth/AdminAuthProvider';
import { Button, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

export default function LoginScreen() {
  const { login, admin } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (admin) router.replace('/accounts');
  }, [admin]);

  async function onSubmit() {
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace('/accounts');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha no login.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.brand}>Sof</Text>
        <Text style={styles.title}>Painel admin</Text>
        <Text style={styles.sub}>Gerencie contas e planos Stripe.</Text>
        <Field
          label="E-mail"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Field
          label="Senha"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title={busy ? 'Entrando…' : 'Entrar'} onPress={onSubmit} disabled={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  brand: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.accent,
  },
  title: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 22,
    color: colors.ink,
    marginTop: space.sm,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginBottom: space.lg,
    marginTop: 4,
  },
  error: {
    color: colors.danger,
    marginBottom: space.md,
    fontFamily: 'Inter_400Regular',
  },
});
