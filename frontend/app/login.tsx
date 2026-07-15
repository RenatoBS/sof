import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { MarketingNav } from '@/src/components/MarketingNav';
import { Button, Input } from '@/src/components/ui';
import { useAuth } from '@/src/auth/AuthProvider';
import { marketingColors } from '@/src/theme/marketing';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(dashboard)/agenda');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.page}>
      <MarketingNav active="login" />
      <Text style={styles.title}>Entrar</Text>
      <Input
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />
      <Input
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={loading ? 'Entrando…' : 'Entrar'}
        onPress={submit}
        variant="accent"
        disabled={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: marketingColors.paper, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  error: { color: '#ef4444', marginBottom: 12 },
});
