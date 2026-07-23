import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MarketingNav, SiteFooter } from '@/src/components/MarketingNav';
import { SofButton, SofInput } from '@/src/components/ui';
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
        <View style={[styles.card, m.shadow.soft]}>
          <Text style={styles.h2}>Redefinir senha</Text>
          <Text style={styles.sub}>
            Para profissionais: informe o e-mail de acesso. Se estiver
            cadastrado com telefone, enviamos o link no WhatsApp (válido por 2
            horas).
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
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
                title={loading ? 'Enviando…' : 'Enviar link no WhatsApp'}
                variant="accent"
                block
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
  ok: {
    color: m.ink,
    backgroundColor: m.accentSoft || '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 18,
    fontSize: 15,
    lineHeight: 22,
  },
  alt: { marginTop: 20, textAlign: 'center', color: m.muted, fontSize: 14 },
  altLink: { color: m.accentInk, fontWeight: '600' },
});
