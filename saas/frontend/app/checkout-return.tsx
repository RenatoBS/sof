import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { checkoutApi } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthProvider';
import { setToken } from '@/src/auth/tokenStorage';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { SofButton, SofErrorBanner } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

type Phase = 'waiting' | 'entering' | 'failed';

export default function CheckoutReturnScreen() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const { refreshMe } = useAuth();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [error, setError] = useState('');
  const entered = useRef(false);

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
        if (data.status !== 'approved') return;

        clearInterval(timer);
        if (entered.current) return;
        entered.current = true;

        if (data.token) {
          setPhase('entering');
          await setToken(data.token);
          await refreshMe();
          router.replace('/(dashboard)/agenda');
          return;
        }

        // Já entregue — se ainda há sessão, só atualiza e entra na agenda.
        await refreshMe();
        router.replace('/(dashboard)/agenda');
      } catch {
        clearInterval(timer);
        setPhase('failed');
        setError(
          'Não encontramos essa sessão de checkout. Se o pagamento foi concluído, fale com o suporte.',
        );
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [ref, refreshMe]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <MarketingNav />
      <View style={styles.wrap}>
        <View style={[styles.card, m.shadow.soft]}>
          {phase === 'waiting' || phase === 'entering' ? (
            <>
              <View style={styles.titleRow}>
                <ActivityIndicator color={m.accentInk} />
                <Text style={styles.title}>
                  {phase === 'entering'
                    ? 'Entrando na agenda…'
                    : 'Confirmando seu pagamento…'}
                </Text>
              </View>
              <Text style={styles.sub}>Isso leva só alguns segundos.</Text>
              <View style={styles.hint}>
                <Text style={styles.hintText}>
                  {phase === 'entering'
                    ? 'Pagamento aprovado. Preparando seu painel.'
                    : 'Aguardando a confirmação do Stripe. Não feche esta página.'}
                </Text>
              </View>
            </>
          ) : null}

          {phase === 'failed' ? (
            <>
              <Text style={styles.title}>Não foi possível confirmar</Text>
              <SofErrorBanner message={error} />
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
      <SiteFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: m.paper },
  content: { flexGrow: 1 },
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 64,
  },
  card: {
    maxWidth: 400,
    width: '100%',
    backgroundColor: m.surface,
    borderRadius: m.radius,
    paddingVertical: 36,
    paddingHorizontal: 32,
    gap: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    flexShrink: 1,
    fontFamily: m.fonts.display,
    fontSize: 28,
    color: m.ink,
    letterSpacing: -0.4,
  },
  sub: { color: m.muted, fontSize: 15, lineHeight: 22, fontFamily: m.fonts.body },
  hint: {
    backgroundColor: m.accentSoft,
    borderRadius: m.radiusSm,
    padding: 14,
    marginTop: 6,
    width: '100%',
  },
  hintText: { color: m.accentInk, fontSize: 14, lineHeight: 20, fontFamily: m.fonts.body },
});
