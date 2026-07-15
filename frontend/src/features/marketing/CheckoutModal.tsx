import { useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { checkoutApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { setToken } from '@/src/auth/tokenStorage';
import { Button, Input } from '@/src/components/ui';
import { marketingColors } from '@/src/theme/marketing';

const PLANS = [
  { name: 'Essencial', price: 99 },
  { name: 'Estúdio', price: 197 },
  { name: 'Rede', price: 249 },
] as const;

export function CheckoutModal({
  visible,
  planName,
  price,
  onClose,
}: {
  visible: boolean;
  planName: string;
  price: number;
  onClose: () => void;
}) {
  const { refreshMe } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{
    email: string;
    tempPassword?: string;
  } | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setError('');
    setSuccess(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pollStatus = (sessionId: string) => {
    const timer = setInterval(async () => {
      try {
        const data = await checkoutApi.status(sessionId);
        if (data.status === 'approved') {
          clearInterval(timer);
          setSuccess({
            email: data.email || email,
            tempPassword: data.tempPassword,
          });
          setLoading(false);
        }
      } catch {
        clearInterval(timer);
        setLoading(false);
      }
    }, 1500);
  };

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await checkoutApi.create(planName, name.trim(), email.trim());
      if (data.mode === 'redirect' && data.initPoint) {
        if (Platform.OS === 'web') {
          window.location.href = data.initPoint;
        } else {
          await Linking.openURL(data.initPoint);
        }
        return;
      }
      if (data.token) {
        await setToken(data.token);
        await refreshMe();
        router.replace('/(dashboard)/agenda');
        handleClose();
        return;
      }
      pollStatus(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no checkout');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Pressable onPress={handleClose} style={styles.close}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>

          {!success ? (
            <>
              <Text style={styles.title}>Assinar plano {planName}</Text>
              <Text style={styles.price}>R$ {price.toFixed(2).replace('.', ',')}/mês</Text>
              <Input label="Nome completo" value={name} onChangeText={setName} />
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                title={loading ? 'Processando…' : 'Continuar'}
                onPress={submit}
                variant="accent"
                disabled={loading || !name || !email}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>Conta criada!</Text>
              <Text style={styles.muted}>E-mail: {success.email}</Text>
              {success.tempPassword ? (
                <Text style={styles.muted}>Senha: {success.tempPassword}</Text>
              ) : null}
              <Button
                title="Ir para o painel"
                onPress={() => {
                  handleClose();
                  router.push('/login');
                }}
                variant="accent"
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function PricingCards({
  onSelect,
}: {
  onSelect: (plan: (typeof PLANS)[number]) => void;
}) {
  return (
    <View style={styles.grid}>
      {PLANS.map((plan) => (
        <View key={plan.name} style={styles.card}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planPrice}>
            R$ {plan.price.toFixed(2).replace('.', ',')}
          </Text>
          <Text style={styles.muted}>/mês</Text>
          <Button title="Começar" onPress={() => onSelect(plan)} variant="accent" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  close: { alignSelf: 'flex-end' },
  closeText: { fontSize: 20, color: marketingColors.muted },
  title: { fontSize: 22, fontWeight: '700', color: marketingColors.ink },
  price: { fontSize: 18, color: marketingColors.accent, fontWeight: '600' },
  muted: { color: marketingColors.muted },
  error: { color: '#ef4444' },
  grid: { gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: marketingColors.line,
    gap: 8,
  },
  planName: { fontSize: 18, fontWeight: '700', color: marketingColors.ink },
  planPrice: { fontSize: 28, fontWeight: '700', color: marketingColors.accent },
});
