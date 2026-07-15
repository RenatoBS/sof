import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { Button, Input } from '@/src/components/ui';
import { dashboardColors } from '@/src/theme/dashboard';

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
    <ScrollView style={styles.page}>
      <Text style={styles.title}>Profissionais</Text>
      <Button
        title={showForm ? 'Cancelar' : 'Adicionar profissional'}
        onPress={() => setShowForm((v) => !v)}
        variant="ghost"
      />
      {showForm ? (
        <View style={styles.form}>
          <Input label="Nome" value={name} onChangeText={setName} />
          <Input label="Especialidade" value={specialty} onChangeText={setSpecialty} />
          <Input label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Salvar" onPress={create} />
        </View>
      ) : null}
      {employees.map((e) => (
        <View key={e.id} style={styles.card}>
          <Text style={[styles.name, { color: e.color }]}>{e.name}</Text>
          <Text style={styles.meta}>{e.specialty}</Text>
          <Pressable onPress={() => remove(e.id)}>
            <Text style={styles.delete}>Remover</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: dashboardColors.bg, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  form: { marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: dashboardColors.line,
  },
  name: { fontWeight: '700', fontSize: 16 },
  meta: { color: dashboardColors.muted },
  delete: { color: dashboardColors.danger, marginTop: 8 },
  error: { color: dashboardColors.danger },
});
