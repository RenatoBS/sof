import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import {
  SofAuthCard,
  SofButton,
  SofErrorBanner,
  SofInput,
} from '@/src/components/ui';
import { authApi, employeeAuthApi } from '@/src/api/endpoints';
import { ApiError } from '@/src/api/client';
import { m } from '@/src/theme/marketing';

export default function EsqueciSenhaScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const normalized = email.trim().toLowerCase();
      // Conta e profissional em endpoints separados (evita ciclo de módulos no Nest).
      await Promise.all([
        authApi.requestPasswordReset(normalized),
        employeeAuthApi.requestPasswordReset(normalized),
      ]);
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
          subtitle="Informe o e-mail de acesso (conta ou profissional). Enviamos o link por e-mail e, se possível, também no WhatsApp (válido por 2 horas)."
        >
          {error ? <SofErrorBanner message={error} /> : null}
          {done ? (
            <>
              <Text style={styles.ok}>
                Se houver uma conta com este e-mail, o link já foi enviado por
                e-mail e/ou WhatsApp. Confira a caixa de entrada e o spam.
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
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                placeholder="voce@negocio.com"
                autoCapitalize="none"
              />
              <SofButton
                title="Enviar link"
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
  altLink: {
    color: m.accentInk,
    fontFamily: m.fonts.bodyMedium,
    fontWeight: '600',
  },
});
