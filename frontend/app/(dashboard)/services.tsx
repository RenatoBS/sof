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
import {
  EntityAvatar,
  EntityCardBody,
  EntityCardFooter,
  EntityStat,
  entityCardStyles as ec,
} from '@/src/features/dashboard/EntityCard';
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
    <View style={ec.page}>
      <SofPageHeader
        title="Serviços"
        subtitle="Cardápio que aparece no WhatsApp e na agenda"
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
      {services.length > 0 ? (
        <Text style={ec.count}>
          {services.length}{' '}
          {services.length === 1 ? 'serviço' : 'serviços'}
        </Text>
      ) : null}

      {showForm ? (
        <SofCard>
          <Text style={ec.formTitle}>
            {isEditing ? 'Editar serviço' : 'Novo serviço'}
          </Text>
          {fromEmployees && !isEditing ? (
            <Text style={ec.formHint}>
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
          <View style={styles.formRow}>
            <View style={styles.formCol}>
              <SofInput
                label="Duração (min)"
                value={duration}
                onChangeText={setDuration}
                theme="dashboard"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formCol}>
              <SofInput
                label="Preço (R$)"
                value={price}
                onChangeText={setPrice}
                theme="dashboard"
                keyboardType="numeric"
              />
            </View>
          </View>
          {error ? <SofErrorBanner message={error} /> : null}
          <View style={ec.formActions}>
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
        <View style={ec.grid}>
          {services.map((s) => (
            <SofCard key={s.id} padded={false} style={ec.entity}>
              <EntityCardBody>
                <View style={styles.head}>
                  <EntityAvatar name={s.name} color={d.accent} />
                  <View style={styles.headCopy}>
                    <Text style={styles.name} numberOfLines={2}>
                      {s.name}
                    </Text>
                  </View>
                </View>
                <View style={styles.stats}>
                  <EntityStat label="Duração" value={`${s.duration} min`} />
                  <EntityStat label="Preço" value={formatCurrency(s.price)} />
                </View>
              </EntityCardBody>
              <EntityCardFooter>
                <SofRowActions
                  onEdit={() => startEdit(s)}
                  onRemove={() => remove(s.id)}
                />
              </EntityCardFooter>
            </SofCard>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  formRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  formCol: { flexGrow: 1, flexBasis: 140, minWidth: 120 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headCopy: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.2,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
