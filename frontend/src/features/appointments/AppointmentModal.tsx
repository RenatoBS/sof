import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Appointment } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import {
  formatPhone,
  useDashboard,
} from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export function AppointmentModal({
  appointment,
  visible,
  onClose,
}: {
  appointment: Appointment | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { employees, services, clients, setAppointments } = useDashboard();
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    const matched =
      appointment.clientId ||
      clients.find(
        (c) =>
          c.phone === appointment.clientPhone ||
          c.name === appointment.clientName,
      )?.id ||
      '';
    setClientId(matched);
    setDate(appointment.date);
    setTime(appointment.time);
    setEmployeeId(appointment.employeeId);
    setServiceId(appointment.serviceId);
    setError('');
  }, [appointment, clients]);

  const selectedClient = clients.find((c) => c.id === clientId);

  const selectService = (id: string) => {
    setServiceId(id);
    setEmployeeId((current) => {
      const emp = employees.find((e) => e.id === current);
      const ok = emp?.services?.some((s) => s.id === id);
      return ok ? current : '';
    });
  };

  const employeesForService = serviceId
    ? employees.filter((e) =>
        (e.services || []).some((s) => s.id === serviceId),
      )
    : employees;

  if (!appointment) return null;

  const save = async () => {
    if (!clientId) {
      setError('Selecione um cliente.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { appointment: updated } = await dashboardApi.updateAppointment(
        appointment.id,
        { clientId, date, time, employeeId, serviceId },
      );
      setAppointments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    setLoading(true);
    try {
      await dashboardApi.deleteAppointment(appointment.id);
      setAppointments((prev) => prev.filter((a) => a.id !== appointment.id));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Editar agendamento</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.label}>Cliente</Text>
            {clients.length === 0 ? (
              <Text style={styles.hint}>
                Cadastre clientes na aba Clientes para vincular ao agendamento.
              </Text>
            ) : (
              clients.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setClientId(c.id)}
                  style={[styles.chip, clientId === c.id && styles.chipActive]}
                >
                  <Text>
                    {c.name} — {formatPhone(c.phone)}
                  </Text>
                </Pressable>
              ))
            )}
            {selectedClient ? (
              <Text style={styles.phoneHint}>
                Telefone: {formatPhone(selectedClient.phone)}
              </Text>
            ) : null}
            <SofInput
              label="Data (AAAA-MM-DD)"
              value={date}
              onChangeText={setDate}
              theme="dashboard"
            />
            <SofInput
              label="Horário (HH:MM)"
              value={time}
              onChangeText={setTime}
              theme="dashboard"
            />
            <Text style={styles.label}>Serviço</Text>
            {services.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => selectService(s.id)}
                style={[styles.chip, serviceId === s.id && styles.chipActive]}
              >
                <Text>
                  {s.name} — R$ {s.price}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Profissional</Text>
            {!serviceId ? (
              <Text style={styles.hint}>Escolha o serviço primeiro.</Text>
            ) : employeesForService.length === 0 ? (
              <Text style={styles.hint}>
                Nenhum profissional realiza este serviço.
              </Text>
            ) : (
              employeesForService.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setEmployeeId(e.id)}
                  style={[styles.chip, employeeId === e.id && styles.chipActive]}
                >
                  <Text>{e.name}</Text>
                </Pressable>
              ))
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <SofButton
              title="Salvar"
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={loading || clients.length === 0}
            />
            <SofButton
              title="Cancelar agendamento"
              variant="danger"
              theme="dashboard"
              onPress={remove}
            />
            <SofButton
              title="Fechar"
              variant="light"
              theme="dashboard"
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: d.radius,
    padding: 32,
    width: '100%',
    maxWidth: 500,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8, color: d.ink },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6, color: '#334155' },
  chip: {
    padding: 12,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    marginBottom: 6,
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  hint: { color: d.muted, fontSize: 14, marginBottom: 8 },
  phoneHint: { color: d.muted, fontSize: 13, marginBottom: 8 },
  error: { color: d.danger },
  actions: { gap: 10, marginTop: 8 },
});
