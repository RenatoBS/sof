import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard, formatCurrency } from '@/src/context/DashboardContext';
import { Button, Input } from '@/src/components/ui';
import { dashboardColors } from '@/src/theme/dashboard';

export default function ServicesScreen() {
  const { services, setServices } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('45');
  const [price, setPrice] = useState('60');
  const [error, setError] = useState('');

  const create = async () => {
    setError('');
    try {
      const { service } = await dashboardApi.createService({
        name: name.trim(),
        duration: parseInt(duration, 10),
        price: parseFloat(price),
      });
      setServices((prev) => [...prev, service]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <ScrollView style={styles.page}>
      <Text style={styles.title}>Serviços</Text>
      <Button
        title={showForm ? 'Cancelar' : 'Adicionar serviço'}
        onPress={() => setShowForm((v) => !v)}
        variant="ghost"
      />
      {showForm ? (
        <View style={styles.form}>
          <Input label="Nome" value={name} onChangeText={setName} />
          <Input label="Duração (min)" value={duration} onChangeText={setDuration} keyboardType="numeric" />
          <Input label="Preço" value={price} onChangeText={setPrice} keyboardType="numeric" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Salvar" onPress={create} />
        </View>
      ) : null}
      {services.map((s) => (
        <View key={s.id} style={styles.card}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.meta}>
            {s.duration} min — {formatCurrency(s.price)}
          </Text>
          <Pressable onPress={() => remove(s.id)}>
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
