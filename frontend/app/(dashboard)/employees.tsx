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
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingId;

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setName('');
    setServiceIds([]);
    setError('');
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
  };

  const startCreate = () => {
    setName('');
    setServiceIds([]);
    setError('');
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setName(employee.name);
    setServiceIds((employee.services || []).map((s) => s.id));
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    if (serviceIds.length === 0) {
      setError('Selecione ao menos um serviço.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        serviceIds,
      };
      if (editingId) {
        const { employee } = await dashboardApi.updateEmployee(editingId, body);
        setEmployees((prev) =>
          prev.map((e) => (e.id === employee.id ? employee : e)),
        );
      } else {
        const { employee } = await dashboardApi.createEmployee(body);
        setEmployees((prev) => [...prev, employee]);
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
          <Text style={styles.sub}>Gerencie sua equipe de trabalho</Text>
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
  },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 8,
  },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  formGrid: { gap: 4 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginTop: 8,
    marginBottom: 8,
  },
  hint: { color: d.muted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: d.line,
    backgroundColor: d.surface,
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { fontSize: 14, color: d.ink },
  chipTextActive: { color: d.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  error: { color: d.danger },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  entity: {
    backgroundColor: d.surface,
    padding: 24,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    minWidth: 280,
    flexGrow: 1,
    flexBasis: 280,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  name: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 14, color: d.muted, marginTop: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cardActions: { flexDirection: 'row', gap: 16 },
  edit: { color: d.accent, fontWeight: '600', fontSize: 14 },
  delete: { color: d.danger, fontWeight: '600', fontSize: 14 },
});
