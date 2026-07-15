import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { checkoutApi } from '@/src/api/endpoints';
import { Button } from '@/src/components/ui';
import { marketingColors } from '@/src/theme/marketing';

export default function CheckoutReturnScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [status, setStatus] = useState('Aguardando confirmação…');
  const [creds, setCreds] = useState<{ email: string; password?: string } | null>(
    null,
  );

  useEffect(() => {
    if (!ref) return;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > 60) {
        clearInterval(timer);
        setStatus('Tempo esgotado. Tente novamente.');
        return;
      }
      try {
        const data = await checkoutApi.status(String(ref));
        if (data.status === 'approved') {
          clearInterval(timer);
          setStatus('Pagamento confirmado!');
          setCreds({ email: data.email || '', password: data.tempPassword });
        }
      } catch {
        clearInterval(timer);
        setStatus('Erro ao consultar pagamento.');
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [ref]);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Retorno do checkout</Text>
      <Text style={styles.status}>{status}</Text>
      {creds ? (
        <>
          <Text>E-mail: {creds.email}</Text>
          {creds.password ? <Text>Senha: {creds.password}</Text> : null}
        </>
      ) : null}
      <Button title="Ir para o login" onPress={() => router.replace('/login')} />
      <Button title="Voltar ao início" onPress={() => router.replace('/')} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, padding: 24, gap: 12, backgroundColor: marketingColors.paper },
  title: { fontSize: 24, fontWeight: '700' },
  status: { color: marketingColors.muted },
});
