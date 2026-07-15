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
import { useDashboard } from '@/src/context/DashboardContext';
import { SoftButton, SoftInput } from '@/src/components/ui';
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
  const { employees, services, setAppointments } = useDashboard();
  const [clientName, setClientName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!appointment) return;
    setClientName(appointment.clientName);
    setDate(appointment.date);
    setTime(appointment.time);
    setEmployeeId(appointment.employeeId);
    setServiceId(appointment.serviceId);
    setError('');
  }, [appointment]);

  if (!appointment) return null;

  const save = async () => {
    setLoading(true);
    setError('');
    try {
      const { appointment: updated } = await dashboardApi.updateAppointment(
        appointment.id,
        { clientName, date, time, employeeId, serviceId },
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
            <SoftInput
              label="Cliente"
              value={clientName}
              onChangeText={setClientName}
              theme="dashboard"
            />
            <SoftInput
              label="Data (AAAA-MM-DD)"
              value={date}
              onChangeText={setDate}
              theme="dashboard"
            />
            <SoftInput
              label="Horário (HH:MM)"
              value={time}
              onChangeText={setTime}
              theme="dashboard"
            />
            <Text style={styles.label}>Profissional</Text>
            {employees.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => setEmployeeId(e.id)}
                style={[styles.chip, employeeId === e.id && styles.chipActive]}
              >
                <Text>{e.name}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Serviço</Text>
            {services.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setServiceId(s.id)}
                style={[styles.chip, serviceId === s.id && styles.chipActive]}
              >
                <Text>
                  {s.name} — R$ {s.price}
                </Text>
              </Pressable>
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <SoftButton
              title="Salvar"
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={loading}
            />
            <SoftButton
              title="Cancelar agendamento"
              variant="danger"
              theme="dashboard"
              onPress={remove}
            />
            <SoftButton
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
  error: { color: d.danger },
  actions: { gap: 10, marginTop: 8 },
});
