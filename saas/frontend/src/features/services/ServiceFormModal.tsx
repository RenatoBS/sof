import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Service } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';

type ServiceFormModalProps = {
  visible: boolean;
  onClose: () => void;
  service?: Service | null;
  fromEmployees?: boolean;
  onSaved: (service: Service) => void;
};

export function ServiceFormModal({
  visible,
  onClose,
  service = null,
  fromEmployees = false,
  onSaved,
}: ServiceFormModalProps) {
  const isEditing = Boolean(service);
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('45');
  const [price, setPrice] = useState('60');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(service?.name || '');
    setDuration(String(service?.duration ?? 45));
    setPrice(String(service?.price ?? 60));
    setError('');
    setLoading(false);
  }, [visible, service]);

  const save = async () => {
    setError('');
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        duration: parseInt(duration, 10),
        price: parseFloat(price),
      };
      const { service: saved } = service
        ? await dashboardApi.updateService(service.id, body)
        : await dashboardApi.createService(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title={isEditing ? 'Editar serviço' : 'Novo serviço'}
      hint={
        fromEmployees && !isEditing
          ? 'Cadastre ao menos um serviço antes de adicionar profissionais.'
          : undefined
      }
      actions={
        <>
          <SofButton
            title={loading ? 'Salvando…' : isEditing ? 'Salvar' : 'Salvar'}
            variant="dark"
            theme="dashboard"
            onPress={save}
            loading={loading}
            disabled={loading}
          />
          <SofButton
            title="Fechar"
            variant="light"
            theme="dashboard"
            onPress={onClose}
            disabled={loading}
          />
        </>
      }
    >
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
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  formRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  formCol: { flexGrow: 1, flexBasis: 140, minWidth: 120 },
});
