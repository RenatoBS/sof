import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { checkoutApi } from '@/src/api/endpoints';
import { MarketingNav } from '@/src/components/MarketingNav';
import { SoftButton } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

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
      <MarketingNav />
      <View style={[styles.card, m.shadow.soft]}>
        <Text style={styles.title}>Retorno do checkout</Text>
        <Text style={styles.status}>{status}</Text>
        {creds ? (
          <View style={styles.creds}>
            <Text>E-mail: {creds.email}</Text>
            {creds.password ? <Text>Senha: {creds.password}</Text> : null}
          </View>
        ) : null}
        <SoftButton
          title="Ir para o login"
          variant="accent"
          block
          onPress={() => router.replace('/login')}
        />
        <SoftButton
          title="Voltar ao início"
          variant="ghost"
          block
          onPress={() => router.replace('/')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: m.paper },
  card: {
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    marginTop: 64,
    backgroundColor: m.surface,
    borderRadius: m.radius,
    padding: 32,
    gap: 14,
  },
  title: {
    fontFamily: m.fonts.display,
    fontSize: 24,
    color: m.ink,
  },
  status: { color: m.muted },
  creds: { gap: 6, backgroundColor: m.paper, padding: 14, borderRadius: 12 },
});
