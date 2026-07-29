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
import { ServiceFormModal } from '@/src/features/services/ServiceFormModal';
import { d } from '@/src/theme/dashboard';

export default function ServicesScreen() {
  const { services, setServices, setEmployees } = useDashboard();
  const { create } = useLocalSearchParams<{ create?: string }>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [fromEmployees, setFromEmployees] = useState(false);

  useEffect(() => {
    if (create !== '1') return;
    setFromEmployees(true);
    setEditing(null);
    setModalOpen(true);
  }, [create]);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFromEmployees(false);
  };

  const startCreate = () => {
    setEditing(null);
    setFromEmployees(false);
    setModalOpen(true);
  };

  const startEdit = (service: Service) => {
    setEditing(service);
    setFromEmployees(false);
    setModalOpen(true);
  };

  const onSaved = (service: Service) => {
    const isCreate = !editing;
    setServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      return exists
        ? prev.map((s) => (s.id === service.id ? service : s))
        : [...prev, service];
    });
    setEmployees((prev) =>
      prev.map((e) => ({
        ...e,
        services: (e.services || []).map((s) =>
          s.id === service.id ? service : s,
        ),
      })),
    );
    if (isCreate && fromEmployees) {
      router.push('/(dashboard)/employees');
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
    if (editing?.id === id) closeModal();
  };

  return (
    <View style={ec.page}>
      <SofPageHeader
        title="Serviços"
        subtitle="Cardápio que aparece no WhatsApp e na agenda"
        action={
          <SofButton
            title="Adicionar serviço"
            variant="dark"
            theme="dashboard"
            onPress={startCreate}
          />
        }
      />
      {services.length > 0 ? (
        <Text style={ec.count}>
          {services.length}{' '}
          {services.length === 1 ? 'serviço' : 'serviços'}
        </Text>
      ) : null}

      {services.length === 0 ? (
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

      <ServiceFormModal
        visible={modalOpen}
        onClose={closeModal}
        service={editing}
        fromEmployees={fromEmployees}
        onSaved={onSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
