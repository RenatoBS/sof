import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { checkoutApi } from '@/src/api/endpoints';
import { SofButton } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

type Phase = 'waiting' | 'approved' | 'failed';

export default function CheckoutReturnScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [error, setError] = useState('');
  const [creds, setCreds] = useState<{ email: string; password?: string } | null>(
    null,
  );

  useEffect(() => {
    if (!ref) {
      setPhase('failed');
      setError(
        'Não encontramos essa sessão de checkout. Se o pagamento foi concluído, fale com o suporte.',
      );
      return;
    }
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > 60) {
        clearInterval(timer);
        setPhase('failed');
        setError('Tempo esgotado. Tente novamente.');
        return;
      }
      try {
        const data = await checkoutApi.status(String(ref));
        if (data.status === 'approved') {
          clearInterval(timer);
          setPhase('approved');
          setCreds({ email: data.email || '', password: data.tempPassword });
        }
      } catch {
        clearInterval(timer);
        setPhase('failed');
        setError(
          'Não encontramos essa sessão de checkout. Se o pagamento foi concluído, fale com o suporte.',
        );
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [ref]);

  return (
    <View style={styles.page}>
      <View style={[styles.card, m.shadow.soft]}>
        {phase === 'waiting' ? (
          <>
            <Text style={styles.title}>Confirmando seu pagamento…</Text>
            <Text style={styles.sub}>Isso leva só alguns segundos.</Text>
            <View style={styles.hint}>
              <Text style={styles.hintText}>
                Aguardando a confirmação do Mercado Pago. Não feche esta página.
              </Text>
            </View>
          </>
        ) : null}

        {phase === 'approved' ? (
          <>
            <Text style={styles.title}>Pagamento aprovado!</Text>
            <Text style={styles.sub}>Guarde seu acesso:</Text>
            <View style={styles.creds}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>E-mail</Text>
                <Text style={styles.credValue}>{creds?.email}</Text>
              </View>
              {creds?.password ? (
                <View style={styles.credRow}>
                  <Text style={styles.credLabel}>Senha</Text>
                  <Text style={styles.credValue}>{creds.password}</Text>
                </View>
              ) : null}
            </View>
            <SofButton
              title="Ir para o login"
              variant="accent"
              block
              onPress={() => router.replace('/login')}
            />
          </>
        ) : null}

        {phase === 'failed' ? (
          <>
            <Text style={styles.title}>Não foi possível confirmar</Text>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <SofButton
              title="Voltar ao início"
              variant="ghost"
              block
              onPress={() => router.replace('/')}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: m.paper,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: m.surface,
    borderRadius: m.radius,
    paddingVertical: 36,
    paddingHorizontal: 32,
    gap: 14,
  },
  title: {
    fontFamily: m.fonts.display,
    fontSize: 28,
    color: m.ink,
    letterSpacing: -0.4,
  },
  sub: { color: m.muted, fontSize: 15, lineHeight: 22 },
  hint: {
    backgroundColor: m.accentSoft,
    borderRadius: m.radiusSm,
    padding: 14,
    marginTop: 6,
  },
  hintText: { color: m.accentInk, fontSize: 14, lineHeight: 20 },
  creds: {
    backgroundColor: m.paper,
    borderRadius: m.radiusSm,
    padding: 16,
    gap: 12,
    marginVertical: 6,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  credLabel: { color: m.muted, fontSize: 14 },
  credValue: { color: m.ink, fontWeight: '600', fontSize: 14, flexShrink: 1 },
  errorBox: {
    backgroundColor: m.dangerSoft,
    borderRadius: m.radiusSm,
    padding: 14,
  },
  errorText: { color: m.danger, fontSize: 14, lineHeight: 20 },
});
