import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard, formatCurrency } from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

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
    <View style={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Serviços</Text>
          <Text style={styles.sub}>Configure seu cardápio de serviços</Text>
        </View>
        <SofButton
          title={showForm ? 'Cancelar' : 'Adicionar Serviço'}
          variant="dark"
          theme="dashboard"
          onPress={() => setShowForm((v) => !v)}
        />
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Novo Serviço</Text>
          <SofInput
            label="Nome do Serviço"
            value={name}
            onChangeText={setName}
            theme="dashboard"
            placeholder="Ex: Corte"
          />
          <SofInput
            label="Duração (minutos)"
            value={duration}
            onChangeText={setDuration}
            theme="dashboard"
            keyboardType="numeric"
          />
          <SofInput
            label="Preço (R$)"
            value={price}
            onChangeText={setPrice}
            theme="dashboard"
            keyboardType="numeric"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SofButton title="Adicionar" variant="dark" theme="dashboard" onPress={create} />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={() => setShowForm(false)}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        {services.map((s) => (
          <View key={s.id} style={styles.entity}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.meta}>
              {s.duration} min — {formatCurrency(s.price)}
            </Text>
            <Pressable onPress={() => remove(s.id)} style={{ marginTop: 16 }}>
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
  },
  cardTitle: { fontWeight: '600', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  error: { color: d.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
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
  name: { fontWeight: '700', fontSize: 16 },
  meta: { fontSize: 14, color: d.muted, marginTop: 4 },
  delete: { color: d.danger, fontWeight: '600', fontSize: 14 },
});
