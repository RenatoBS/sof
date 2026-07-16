import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { employeeAuthApi } from '@/src/api/endpoints';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export default function TrocarSenhaScreen() {
  const { employee, setEmployeeSession } = useEmployeeAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!employee) return null;

  const submit = async () => {
    setError('');
    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setLoading(true);
    try {
      const { employee: updated } = await employeeAuthApi.changePassword(
        currentPassword,
        newPassword,
      );
      await setEmployeeSession(updated);
      router.replace('/(profissional)/agenda');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.h2}>Trocar senha</Text>
        <Text style={styles.sub}>
          {employee.mustChangePassword
            ? 'No primeiro acesso, escolha uma nova senha para continuar.'
            : 'Atualize sua senha de acesso.'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SofInput
          label="Senha atual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          theme="dashboard"
          placeholder="Senha temporária ou atual"
        />
        <SofInput
          label="Nova senha"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          theme="dashboard"
          placeholder="Mínimo 6 caracteres"
        />
        <SofInput
          label="Confirmar nova senha"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          theme="dashboard"
          placeholder="Repita a nova senha"
        />
        <SofButton
          title={loading ? 'Salvando…' : 'Salvar e continuar'}
          variant="dark"
          theme="dashboard"
          disabled={loading}
          onPress={submit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 420 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  h2: { fontSize: 24, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  error: { color: '#dc2626', fontWeight: '600' },
});
