import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Appointment, Client, Employee, Service } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useOptionalDashboard } from '@/src/context/DashboardContext';
import { ClientPicker } from '@/src/features/clients/ClientPicker';
import { ServicePicker } from '@/src/features/services/ServicePicker';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export type AppointmentDraft = {
  employeeId: string;
  date: string;
  time?: string;
};

type AppointmentModalProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  appointment?: Appointment | null;
  initial?: AppointmentDraft | null;
  lockEmployeeId?: string;
  clients?: Client[];
  services?: Service[];
  employees?: Employee[];
  onClientCreated?: (client: Client) => void;
  onSaved?: (appointment: Appointment) => void;
  onDeleted?: (appointmentId: string) => void;
  createAppointment?: (body: {
    clientId: string;
    date: string;
    time: string;
    employeeId: string;
    serviceId: string;
  }) => Promise<{ appointment: Appointment }>;
  updateAppointment?: (
    id: string,
    body: {
      clientId: string;
      date: string;
      time: string;
      employeeId: string;
      serviceId: string;
    },
  ) => Promise<{ appointment: Appointment }>;
  deleteAppointment?: (id: string) => Promise<unknown>;
  createClient?: (body: {
    name: string;
    phone: string;
  }) => Promise<{ client: Client }>;
};

export function AppointmentModal({
  visible,
  onClose,
  mode,
  appointment = null,
  initial = null,
  lockEmployeeId,
  clients: clientsProp,
  services: servicesProp,
  employees: employeesProp,
  onClientCreated,
  onSaved,
  onDeleted,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  createClient,
}: AppointmentModalProps) {
  const dashboard = useOptionalDashboard();
  const clients = clientsProp ?? dashboard?.clients ?? [];
  const services = servicesProp ?? dashboard?.services ?? [];
  const employees = employeesProp ?? dashboard?.employees ?? [];

  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isCreate = mode === 'create';

  useEffect(() => {
    if (!visible) return;
    setError('');
    if (mode === 'edit' && appointment) {
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
      setEmployeeId(lockEmployeeId || appointment.employeeId);
      setServiceId(appointment.serviceId);
      return;
    }
    if (mode === 'create' && initial) {
      setClientId('');
      setDate(initial.date);
      setTime(initial.time || '09:00');
      setEmployeeId(lockEmployeeId || initial.employeeId);
      setServiceId('');
    }
  }, [visible, mode, appointment, initial, clients, lockEmployeeId]);

  const selectService = (id: string) => {
    setServiceId(id);
    if (lockEmployeeId || !id) return;
    setEmployeeId((current) => {
      if (!current) return current;
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

  const canShow = isCreate ? !!initial : !!appointment;
  if (!canShow) return null;

  const resolveCreateClient = async (body: {
    name: string;
    phone: string;
  }) => {
    const fn = createClient || dashboardApi.createClient;
    const { client } = await fn(body);
    if (onClientCreated) {
      onClientCreated(client);
    } else if (!clientsProp && dashboard) {
      dashboard.setClients((prev) =>
        [...prev.filter((c) => c.id !== client.id), client].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        ),
      );
    }
    return client;
  };

  const save = async () => {
    if (!clientId) {
      setError('Selecione um cliente.');
      return;
    }
    if (!serviceId) {
      setError('Selecione um serviço.');
      return;
    }
    if (!employeeId) {
      setError('Selecione um profissional.');
      return;
    }
    setLoading(true);
    setError('');
    const body = {
      clientId,
      date,
      time,
      employeeId: lockEmployeeId || employeeId,
      serviceId,
    };
    try {
      if (isCreate) {
        const fn = createAppointment || dashboardApi.createAppointment;
        const { appointment: created } = await fn(body);
        if (onSaved) onSaved(created);
        else if (dashboard) {
          dashboard.setAppointments((prev) =>
            prev.some((a) => a.id === created.id) ? prev : [...prev, created],
          );
        }
      } else if (appointment) {
        const fn = updateAppointment || dashboardApi.updateAppointment;
        const { appointment: updated } = await fn(appointment.id, body);
        if (onSaved) onSaved(updated);
        else if (dashboard) {
          dashboard.setAppointments((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a)),
          );
        }
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const fn = deleteAppointment || dashboardApi.deleteAppointment;
      await fn(appointment.id);
      if (onDeleted) onDeleted(appointment.id);
      else if (dashboard) {
        dashboard.setAppointments((prev) =>
          prev.filter((a) => a.id !== appointment.id),
        );
      }
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
          <Text style={styles.title}>
            {isCreate ? 'Novo agendamento' : 'Editar agendamento'}
          </Text>
          <ScrollView style={{ maxHeight: 460 }}>
            <ClientPicker
              clients={clients}
              clientId={clientId}
              onSelect={setClientId}
              onCreateClient={resolveCreateClient}
            />
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
              placeholder="09:00"
            />
            <ServicePicker
              services={services}
              serviceId={serviceId}
              onSelect={selectService}
            />
            {!lockEmployeeId ? (
              <>
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
                      style={[
                        styles.chip,
                        employeeId === e.id && styles.chipActive,
                      ]}
                    >
                      <Text>{e.name}</Text>
                    </Pressable>
                  ))
                )}
              </>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <SofButton
              title={loading ? 'Salvando…' : isCreate ? 'Agendar' : 'Salvar'}
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={loading}
            />
            {!isCreate ? (
              <SofButton
                title="Cancelar agendamento"
                variant="danger"
                theme="dashboard"
                onPress={remove}
              />
            ) : null}
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
  error: { color: d.danger },
  actions: { gap: 10, marginTop: 8 },
});
