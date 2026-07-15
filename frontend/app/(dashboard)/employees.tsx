import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { SoftButton, SoftInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export default function EmployeesScreen() {
  const { employees, setEmployees } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const create = async () => {
    setError('');
    try {
      const { employee } = await dashboardApi.createEmployee({
        name: name.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
      });
      setEmployees((prev) => [...prev, employee]);
      setName('');
      setSpecialty('');
      setPhone('');
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Profissionais</Text>
          <Text style={styles.sub}>Gerencie sua equipe de trabalho</Text>
        </View>
        <SoftButton
          title={showForm ? 'Cancelar' : 'Adicionar Profissional'}
          variant="dark"
          theme="dashboard"
          onPress={() => setShowForm((v) => !v)}
        />
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Novo Profissional</Text>
          <View style={styles.formGrid}>
            <SoftInput
              label="Nome"
              value={name}
              onChangeText={setName}
              theme="dashboard"
              placeholder="Nome completo"
              autoCapitalize="words"
            />
            <SoftInput
              label="Especialidade"
              value={specialty}
              onChangeText={setSpecialty}
              theme="dashboard"
              placeholder="Ex: Cortes"
            />
            <SoftInput
              label="Telefone"
              value={phone}
              onChangeText={setPhone}
              theme="dashboard"
              keyboardType="phone-pad"
              placeholder="+55 11 9999-9999"
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SoftButton title="Adicionar" variant="dark" theme="dashboard" onPress={create} />
            <SoftButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={() => setShowForm(false)}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        {employees.map((e) => (
          <View key={e.id} style={styles.entity}>
            <View style={styles.rowTop}>
              <View>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.meta}>{e.specialty || '—'}</Text>
                {e.phone ? <Text style={styles.meta}>{e.phone}</Text> : null}
              </View>
              <View style={[styles.dot, { backgroundColor: e.color }]} />
            </View>
            <Pressable onPress={() => remove(e.id)}>
              <Text style={styles.delete}>Remover</Text>
            </Pressable>
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
  delete: { color: d.danger, fontWeight: '600', fontSize: 14 },
});
