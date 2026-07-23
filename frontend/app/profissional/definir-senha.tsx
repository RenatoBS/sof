import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { employeeAuthApi } from '@/src/api/endpoints';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

const PASSWORD_MIN = 8;

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
      router.replace('/(profissional)/agenda');
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
        <ActivityIndicator color={d.muted} />
        <Text style={styles.gateText}>Validando link…</Text>
      </View>
    );
  }

  if (infoError) {
    return (
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.h2}>Link indisponível</Text>
          <Text style={styles.sub}>{infoError}</Text>
          <Text style={styles.hint}>
            Peça ao responsável da conta um novo link de acesso. Links expiram
            em 2 horas e só podem ser usados uma vez.
          </Text>
          <SofButton
            title="Ir para o login"
            variant="dark"
            theme="dashboard"
            onPress={() => router.replace('/login')}
          />
        </View>
      </View>
    );
  }

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR')
    : '';

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.brand}>Sof</Text>
        <Text style={styles.h2}>Definir senha</Text>
        <Text style={styles.sub}>
          {name ? `Olá, ${name}. ` : ''}
          {businessName ? `Acesso a ${businessName}.` : ''}
        </Text>

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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <SofInput
          label="Nova senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          theme="dashboard"
          placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
        />
        <SofInput
          label="Confirmar senha"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          theme="dashboard"
          placeholder="Repita a nova senha"
        />
        <SofButton
          title={saving ? 'Salvando…' : 'Salvar e entrar'}
          variant="dark"
          theme="dashboard"
          disabled={saving}
          onPress={submit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: d.paper,
    padding: 32,
  },
  gateText: { color: d.muted, fontSize: 15 },
  page: {
    flex: 1,
    backgroundColor: d.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  brand: {
    fontSize: 20,
    fontWeight: '700',
    color: d.ink,
  },
  h2: { fontSize: 24, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, lineHeight: 20 },
  emailBox: {
    backgroundColor: d.paper,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: d.line,
    padding: 14,
    gap: 4,
    marginVertical: 4,
  },
  emailLabel: { fontSize: 12, fontWeight: '600', color: d.muted },
  emailValue: { fontSize: 16, fontWeight: '700', color: d.ink },
  emailHint: { fontSize: 12, color: d.muted, lineHeight: 18, marginTop: 4 },
  hint: { color: d.muted, fontSize: 13, lineHeight: 18 },
  error: { color: '#dc2626', fontWeight: '600' },
});
