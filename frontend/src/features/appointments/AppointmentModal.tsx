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
import { Button, Input } from '@/src/components/ui';
import { dashboardColors } from '@/src/theme/dashboard';

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
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Editar agendamento</Text>
          <ScrollView>
            <Input label="Cliente" value={clientName} onChangeText={setClientName} />
            <Input label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} />
            <Input label="Horário (HH:MM)" value={time} onChangeText={setTime} />
            <Text style={styles.label}>Profissional</Text>
            {employees.map((e) => (
              <Pressable
                key={e.id}
                onPress={() => setEmployeeId(e.id)}
                style={[
                  styles.chip,
                  employeeId === e.id && styles.chipActive,
                ]}
              >
                <Text>{e.name}</Text>
              </Pressable>
            ))}
            <Text style={styles.label}>Serviço</Text>
            {services.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setServiceId(s.id)}
                style={[
                  styles.chip,
                  serviceId === s.id && styles.chipActive,
                ]}
              >
                <Text>
                  {s.name} — R$ {s.price}
                </Text>
              </Pressable>
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <Button title="Salvar" onPress={save} disabled={loading} />
          <Button title="Cancelar agendamento" onPress={remove} variant="ghost" />
          <Button title="Fechar" onPress={onClose} variant="ghost" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    padding: 20,
    maxHeight: '85%',
    gap: 10,
  },
  title: { fontSize: 20, fontWeight: '700', color: dashboardColors.ink },
  label: { fontWeight: '600', marginTop: 8, marginBottom: 6 },
  chip: {
    padding: 10,
    borderWidth: 1,
    borderColor: dashboardColors.line,
    borderRadius: 8,
    marginBottom: 6,
  },
  chipActive: { borderColor: dashboardColors.accent, backgroundColor: '#eff6ff' },
  error: { color: dashboardColors.danger },
});
