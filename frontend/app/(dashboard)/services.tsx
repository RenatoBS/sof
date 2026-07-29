import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { Service } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard, formatCurrency } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofErrorBanner,
  SofInput,
  SofPageHeader,
  SofRowActions,
} from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export default function ServicesScreen() {
  const { services, setServices, setEmployees } = useDashboard();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('45');
  const [price, setPrice] = useState('60');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fromEmployees, setFromEmployees] = useState(false);

  const isEditing = !!editingId;

  useEffect(() => {
    if (create !== '1') return;
    setFromEmployees(true);
    setName('');
    setDuration('45');
    setPrice('60');
    setError('');
    setEditingId(null);
    setShowForm(true);
  }, [create]);

  const resetForm = () => {
    setName('');
    setDuration('45');
    setPrice('60');
    setError('');
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
    setFromEmployees(false);
  };

  const startCreate = () => {
    setName('');
    setDuration('45');
    setPrice('60');
    setError('');
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (service: Service) => {
    setEditingId(service.id);
    setName(service.name);
    setDuration(String(service.duration));
    setPrice(String(service.price));
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        duration: parseInt(duration, 10),
        price: parseFloat(price),
      };
      if (editingId) {
        const { service } = await dashboardApi.updateService(editingId, body);
        setServices((prev) =>
          prev.map((s) => (s.id === service.id ? service : s)),
        );
        setEmployees((prev) =>
          prev.map((e) => ({
            ...e,
            services: (e.services || []).map((s) =>
              s.id === service.id ? service : s,
            ),
          })),
        );
      } else {
        const { service } = await dashboardApi.createService(body);
        setServices((prev) => [...prev, service]);
        if (fromEmployees) {
          resetForm();
          router.push('/(dashboard)/employees');
          return;
        }
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteService(id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    setEmployees((prev) =>
      prev.map((e) => ({
        ...e,
        services: (e.services || []).filter((s) => s.id !== id),
      })),
    );
    if (editingId === id) resetForm();
  };

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Serviços"
        subtitle="Configure o cardápio de serviços do estabelecimento"
        action={
          <SofButton
            title={showForm ? 'Cancelar' : 'Adicionar serviço'}
            variant="dark"
            theme="dashboard"
            onPress={() => {
              if (showForm) resetForm();
              else startCreate();
            }}
          />
        }
      />

      {showForm ? (
        <SofCard>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar serviço' : 'Novo serviço'}
          </Text>
          {fromEmployees && !isEditing ? (
            <Text style={styles.fromHint}>
              Cadastre ao menos um serviço antes de adicionar profissionais.
            </Text>
          ) : null}
          <SofInput
            label="Nome do serviço"
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
          {error ? <SofErrorBanner message={error} /> : null}
          <View style={styles.actions}>
            <SofButton
              title={isEditing ? 'Salvar alterações' : 'Adicionar'}
              variant="dark"
              theme="dashboard"
              onPress={save}
              loading={loading}
              disabled={loading}
            />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={resetForm}
            />
          </View>
        </SofCard>
      ) : null}

      {services.length === 0 && !showForm ? (
        <SofCard padded={false}>
          <SofEmptyState
            title="Nenhum serviço ainda"
            body="Cadastre os serviços que seus clientes poderão agendar pelo WhatsApp e pelo painel."
            action={
              <SofButton
                title="Adicionar serviço"
                variant="dark"
                theme="dashboard"
                onPress={startCreate}
              />
            }
          />
        </SofCard>
      ) : (
        <View style={styles.grid}>
          {services.map((s) => (
            <SofCard key={s.id} style={styles.entity}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.meta}>
                {s.duration} min — {formatCurrency(s.price)}
              </Text>
              <View style={styles.cardActions}>
                <SofRowActions
                  onEdit={() => startEdit(s)}
                  onRemove={() => remove(s.id)}
                />
              </View>
            </SofCard>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 16,
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  fromHint: {
    color: d.muted,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: d.fonts.body,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    minWidth: 280,
    flexGrow: 1,
    flexBasis: 280,
  },
  name: {
    fontWeight: '700',
    fontSize: 16,
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  meta: {
    fontSize: 14,
    color: d.muted,
    marginTop: 4,
    fontFamily: d.fonts.body,
  },
  cardActions: { marginTop: 16 },
});
