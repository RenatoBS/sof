import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { SofAuthCard, SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { employeeAuthApi } from '@/src/api/endpoints';
import { ApiError } from '@/src/api/client';
import { m } from '@/src/theme/marketing';

export default function EsqueciSenhaProfissionalScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await employeeAuthApi.requestPasswordReset(email.trim().toLowerCase());
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'Não foi possível solicitar o reset.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <MarketingNav active="login" />
      <View style={styles.auth}>
        <SofAuthCard
          title="Redefinir senha"
          subtitle="Para profissionais: informe o e-mail de acesso. Se estiver cadastrado com telefone, enviamos o link no WhatsApp (válido por 2 horas)."
        >
          {error ? <SofErrorBanner message={error} /> : null}
          {done ? (
            <>
              <Text style={styles.ok}>
                Se houver um profissional com este e-mail e telefone
                cadastrado, o link já foi enviado no WhatsApp.
              </Text>
              <SofButton
                title="Voltar ao login"
                variant="accent"
                block
                onPress={() => router.replace('/login')}
              />
            </>
          ) : (
            <>
              <SofInput
                label="E-mail do profissional"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="voce@salao.com"
                autoCapitalize="none"
              />
              <SofButton
                title="Enviar link no WhatsApp"
                variant="accent"
                block
                loading={loading}
                disabled={loading || !email.trim()}
                onPress={submit}
              />
              <Text style={styles.alt}>
                <Text
                  style={styles.altLink}
                  onPress={() => router.replace('/login')}
                >
                  Voltar ao login
                </Text>
              </Text>
            </>
          )}
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
  ok: {
    color: m.ink,
    backgroundColor: m.accentSoft,
    padding: 14,
    borderRadius: m.radiusSm,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: m.fonts.body,
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
