import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { employeeAuthApi } from '@/src/api/endpoints';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { SofAuthCard, SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { m } from '@/src/theme/marketing';

const PASSWORD_MIN = 8;
const PASSWORD_HINT = `Use pelo menos ${PASSWORD_MIN} caracteres.`;

export default function DefinirSenhaScreen() {
  const params = useLocalSearchParams<{ token?: string }>();
  const token = String(params.token || '').trim();
  const { setEmployeeSession } = useEmployeeAuth();

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setInfoError('Link inválido.');
        setLoadingInfo(false);
        return;
      }
      try {
        const data = await employeeAuthApi.passwordSetupInfo(token);
        if (cancelled) return;
        setEmail(data.email);
        setName(data.name);
        setBusinessName(data.businessName);
        setExpiresAt(data.expiresAt);
      } catch (err) {
        if (!cancelled) {
          setInfoError(
            err instanceof Error
              ? err.message
              : 'Link inválido, expirado ou já utilizado.',
          );
        }
      } finally {
        if (!cancelled) setLoadingInfo(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    setError('');
    if (password.length < PASSWORD_MIN) {
      setError(`A senha deve ter pelo menos ${PASSWORD_MIN} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setSaving(true);
    try {
      const { employee, token: jwt } = await employeeAuthApi.passwordSetup(
        token,
        password,
      );
      await setEmployeeSession(employee, jwt);
      router.replace('/(employee)/agenda');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível definir a senha.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingInfo) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator color={m.muted} />
        <Text style={styles.gateText}>Validando link…</Text>
      </View>
    );
  }

  if (infoError) {
    return (
      <View style={styles.page}>
        <SofAuthCard title="Link indisponível" subtitle={infoError}>
          <Text style={styles.hint}>
            Peça ao responsável da conta um novo link de acesso. Links expiram
            em 2 horas e só podem ser usados uma vez.
          </Text>
          <SofButton
            title="Ir para o login"
            variant="accent"
            block
            onPress={() => router.replace('/login')}
          />
        </SofAuthCard>
      </View>
    );
  }

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR')
    : '';

  return (
    <View style={styles.page}>
      <SofAuthCard
        title="Definir senha"
        subtitle={
          [name ? `Olá, ${name}.` : '', businessName ? `Acesso a ${businessName}.` : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
      >
        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>E-mail de login</Text>
          <Text style={styles.emailValue}>{email}</Text>
          <Text style={styles.emailHint}>
            Use este e-mail nas próximas vezes que entrar no Sof.
          </Text>
        </View>

        {expiresLabel ? (
          <Text style={styles.hint}>Este link vale até {expiresLabel}.</Text>
        ) : null}

        {error ? <SofErrorBanner message={error} /> : null}

        <SofInput
          label="Nova senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Crie uma senha"
        />
        <Text style={styles.passwordHint}>{PASSWORD_HINT}</Text>
        <SofInput
          label="Confirmar senha"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Repita a nova senha"
        />
        <SofButton
          title="Salvar e entrar"
          variant="accent"
          block
          loading={saving}
          disabled={saving}
          onPress={submit}
        />
      </SofAuthCard>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: m.paper,
    padding: 32,
  },
  gateText: { color: m.muted, fontSize: 15, fontFamily: m.fonts.body },
  page: {
    flex: 1,
    backgroundColor: m.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emailBox: {
    backgroundColor: m.paper,
    borderRadius: m.radiusSm,
    borderWidth: 1,
    borderColor: m.line,
    padding: 14,
    gap: 4,
    marginBottom: 20,
  },
  emailLabel: {
    fontSize: 12,
    color: m.muted,
    fontFamily: m.fonts.bodyMedium,
  },
  emailValue: { fontSize: 16, color: m.ink, fontFamily: m.fonts.displayBold },
  emailHint: { fontSize: 12, color: m.muted, lineHeight: 18, marginTop: 4, fontFamily: m.fonts.body },
  hint: {
    color: m.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    fontFamily: m.fonts.body,
  },
  passwordHint: {
    marginTop: -10,
    marginBottom: 14,
    fontSize: 12.5,
    color: m.muted,
    fontFamily: m.fonts.body,
  },
});
