import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Employee } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export default function EmployeesScreen() {
  const { employees, setEmployees, services } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState('');

  const isEditing = !!editingId;

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setServiceIds([]);
    setResetPassword(false);
    setError('');
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
  };

  const startCreate = () => {
    setName('');
    setEmail('');
    setServiceIds([]);
    setResetPassword(false);
    setError('');
    setTempPassword('');
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setName(employee.name);
    setEmail(employee.email || '');
    setServiceIds((employee.services || []).map((s) => s.id));
    setResetPassword(false);
    setError('');
    setTempPassword('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    if (serviceIds.length === 0) {
      setError('Selecione ao menos um serviço.');
      return;
    }
    if (!email.trim()) {
      setError('Informe o e-mail de acesso do profissional.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        serviceIds,
      };
      if (editingId) {
        const { employee, temporaryPassword } = await dashboardApi.updateEmployee(
          editingId,
          { ...body, resetPassword },
        );
        setEmployees((prev) =>
          prev.map((e) => (e.id === employee.id ? employee : e)),
        );
        if (temporaryPassword) {
          setTempPassword(temporaryPassword);
          setShowForm(false);
          setEditingId(null);
          return;
        }
      } else {
        const { employee, temporaryPassword } =
          await dashboardApi.createEmployee(body);
        setEmployees((prev) => [...prev, employee]);
        setTempPassword(temporaryPassword);
        setShowForm(false);
        setEditingId(null);
        return;
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Profissionais</Text>
          <Text style={styles.sub}>
            Gerencie a equipe e o acesso de cada profissional
          </Text>
        </View>
        <SofButton
          title={showForm ? 'Cancelar' : 'Adicionar Profissional'}
          variant="dark"
          theme="dashboard"
          onPress={() => {
            if (showForm) resetForm();
            else startCreate();
          }}
        />
      </View>

      {tempPassword ? (
        <View style={styles.passwordCard}>
          <Text style={styles.cardTitle}>Senha temporária gerada</Text>
          <Text style={styles.hint}>
            Anote e envie ao profissional. No primeiro acesso em{' '}
            <Text style={styles.code}>/login</Text> será pedida a troca de
            senha.
          </Text>
          <Text style={styles.tempPass}>{tempPassword}</Text>
          <SofButton
            title="Ok, já anotei"
            variant="dark"
            theme="dashboard"
            onPress={() => setTempPassword('')}
          />
        </View>
      ) : null}

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar Profissional' : 'Novo Profissional'}
          </Text>
          <View style={styles.formGrid}>
            <SofInput
              label="Nome"
              value={name}
              onChangeText={setName}
              theme="dashboard"
              placeholder="Nome completo"
              autoCapitalize="words"
            />
            <SofInput
              label="E-mail de acesso"
              value={email}
              onChangeText={setEmail}
              theme="dashboard"
              placeholder="profissional@salao.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Serviços que realiza</Text>
            {services.length === 0 ? (
              <Text style={styles.hint}>
                Cadastre serviços na aba Serviços antes de salvar um
                profissional.
              </Text>
            ) : (
              <View style={styles.chips}>
                {services.map((s) => {
                  const active = serviceIds.includes(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => toggleService(s.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text
                        style={[styles.chipText, active && styles.chipTextActive]}
                      >
                        {s.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {isEditing ? (
              <Pressable
                onPress={() => setResetPassword((v) => !v)}
                style={[styles.resetChip, resetPassword && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    resetPassword && styles.chipTextActive,
                  ]}
                >
                  {resetPassword
                    ? '✓ Gerar nova senha temporária'
                    : 'Gerar nova senha temporária'}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                Uma senha temporária será gerada automaticamente ao salvar.
              </Text>
            )}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SofButton
              title={
                loading
                  ? 'Salvando…'
                  : isEditing
                    ? 'Salvar alterações'
                    : 'Adicionar'
              }
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={services.length === 0 || loading}
            />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={resetForm}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        {employees.map((e) => (
          <View key={e.id} style={styles.entity}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.meta}>{e.email || 'Sem e-mail de acesso'}</Text>
                <Text style={styles.meta}>
                  {(e.services || []).map((s) => s.name).join(', ') || '—'}
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: e.color }]} />
            </View>
            <View style={styles.cardActions}>
              <Pressable onPress={() => startEdit(e)}>
                <Text style={styles.edit}>Editar</Text>
              </Pressable>
              <Pressable onPress={() => remove(e.id)}>
                <Text style={styles.delete}>Remover</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  passwordCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 24,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: d.ink },
  formGrid: { gap: 12 },
  label: { fontWeight: '600', color: d.ink, fontSize: 14 },
  hint: { color: d.muted, fontSize: 13, lineHeight: 20 },
  code: { fontFamily: 'monospace', color: d.ink },
  tempPass: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
    color: d.ink,
    fontFamily: 'monospace',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  resetChip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { color: d.ink, fontSize: 13 },
  chipTextActive: { fontWeight: '700' },
  error: { color: '#dc2626', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 20,
    width: 280,
    gap: 12,
  },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { fontSize: 17, fontWeight: '700', color: d.ink },
  meta: { color: d.muted, fontSize: 13, marginTop: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 16 },
  edit: { color: d.accent, fontWeight: '600' },
  delete: { color: '#dc2626', fontWeight: '600' },
});
