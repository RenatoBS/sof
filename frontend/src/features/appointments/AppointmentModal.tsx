import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  Appointment,
  AppointmentKind,
  AppointmentWriteBody,
  Client,
  Employee,
  RecurrenceFrequency,
  Service,
} from '@/src/api/types';
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
  onSaved?: (appointment: Appointment, series?: Appointment[]) => void;
  onDeleted?: (appointmentIds: string[]) => void;
  createAppointment?: (
    body: AppointmentWriteBody,
  ) => Promise<{ appointment: Appointment; appointments?: Appointment[] }>;
  updateAppointment?: (
    id: string,
    body: AppointmentWriteBody,
  ) => Promise<{ appointment: Appointment }>;
  deleteAppointment?: (
    id: string,
    scope?: 'one' | 'series',
  ) => Promise<unknown>;
  createClient?: (body: {
    name: string;
    phone: string;
  }) => Promise<{ client: Client }>;
};

const FREQ_OPTIONS: { id: RecurrenceFrequency; label: string }[] = [
  { id: 'none', label: 'Não repetir' },
  { id: 'daily', label: 'Diário' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
];

function defaultUntil(fromDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return '';
  const [y, m, d] = fromDate.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 28);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

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

  const [kind, setKind] = useState<AppointmentKind>('service');
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('none');
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isCreate = mode === 'create';
  const isBlock = kind === 'block';
  const inSeries = Boolean(appointment?.recurrenceGroupId);

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
      setKind(appointment.kind === 'block' ? 'block' : 'service');
      setTitle(appointment.title || '');
      setDurationMinutes(
        String(appointment.durationMinutes || 60),
      );
      setClientId(matched);
      setDate(appointment.date);
      setTime(appointment.time);
      setEmployeeId(lockEmployeeId || appointment.employeeId);
      setServiceId(appointment.serviceId || '');
      setFrequency('none');
      setUntil('');
      return;
    }
    if (mode === 'create' && initial) {
      setKind('service');
      setTitle('');
      setDurationMinutes('60');
      setClientId('');
      setDate(initial.date);
      setTime(initial.time || '09:00');
      setEmployeeId(lockEmployeeId || initial.employeeId);
      setServiceId('');
      setFrequency('none');
      setUntil(defaultUntil(initial.date));
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

  const mergeCreated = (series: Appointment[]) => {
    if (!dashboard) return;
    dashboard.setAppointments((prev) => {
      const ids = new Set(series.map((a) => a.id));
      return [...prev.filter((a) => !ids.has(a.id)), ...series];
    });
  };

  const save = async () => {
    if (!employeeId && !lockEmployeeId) {
      setError('Selecione um profissional.');
      return;
    }
    if (isBlock) {
      if (!title.trim()) {
        setError('Informe o título do evento.');
        return;
      }
      const duration = Number(durationMinutes);
      if (!Number.isFinite(duration) || duration < 5) {
        setError('Informe a duração em minutos (mín. 5).');
        return;
      }
    } else {
      if (!clientId) {
        setError('Selecione um cliente.');
        return;
      }
      if (!serviceId) {
        setError('Selecione um serviço.');
        return;
      }
    }
    if (isCreate && frequency !== 'none' && !until) {
      setError('Informe até quando repetir.');
      return;
    }

    setLoading(true);
    setError('');

    const body: AppointmentWriteBody = {
      kind,
      date,
      time,
      employeeId: lockEmployeeId || employeeId,
      ...(isBlock
        ? {
            title: title.trim(),
            durationMinutes: Number(durationMinutes),
          }
        : {
            clientId,
            serviceId,
          }),
      ...(isCreate && frequency !== 'none'
        ? { recurrence: { frequency, until } }
        : {}),
    };

    try {
      if (isCreate) {
        const fn = createAppointment || dashboardApi.createAppointment;
        const result = await fn(body);
        const series = result.appointments?.length
          ? result.appointments
          : [result.appointment];
        if (onSaved) onSaved(result.appointment, series);
        else mergeCreated(series);
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

  const remove = async (scope: 'one' | 'series' = 'one') => {
    if (!appointment) return;
    setLoading(true);
    try {
      const fn = deleteAppointment || dashboardApi.deleteAppointment;
      await fn(appointment.id, scope);
      const ids =
        scope === 'series' && appointment.recurrenceGroupId && dashboard
          ? dashboard.appointments
              .filter(
                (a) => a.recurrenceGroupId === appointment.recurrenceGroupId,
              )
              .map((a) => a.id)
          : [appointment.id];
      if (onDeleted) onDeleted(ids);
      else if (dashboard) {
        const idSet = new Set(ids);
        dashboard.setAppointments((prev) =>
          prev.filter((a) => !idSet.has(a.id)),
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
            {isCreate
              ? isBlock
                ? 'Novo evento'
                : 'Novo agendamento'
              : isBlock
                ? 'Editar evento'
                : 'Editar agendamento'}
          </Text>
          <ScrollView style={{ maxHeight: 520 }}>
            <>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.rowChips}>
                <Pressable
                  onPress={() => setKind('service')}
                  style={[
                    styles.chip,
                    styles.chipInline,
                    kind === 'service' && styles.chipActive,
                  ]}
                >
                  <Text>Serviço</Text>
                </Pressable>
                <Pressable
                  onPress={() => setKind('block')}
                  style={[
                    styles.chip,
                    styles.chipInline,
                    kind === 'block' && styles.chipActive,
                  ]}
                >
                  <Text>Evento / bloqueio</Text>
                </Pressable>
              </View>
            </>

            {isBlock ? (
              <>
                <SofInput
                  label="Título (ex.: Almoço, Médico)"
                  value={title}
                  onChangeText={setTitle}
                  theme="dashboard"
                  placeholder="Almoço"
                />
                <SofInput
                  label="Duração (minutos)"
                  value={durationMinutes}
                  onChangeText={setDurationMinutes}
                  theme="dashboard"
                  placeholder="60"
                  keyboardType="number-pad"
                />
              </>
            ) : (
              <ClientPicker
                clients={clients}
                clientId={clientId}
                onSelect={setClientId}
                onCreateClient={resolveCreateClient}
              />
            )}

            <SofInput
              label="Data (AAAA-MM-DD)"
              value={date}
              onChangeText={(v) => {
                setDate(v);
                if (frequency !== 'none' && !until) setUntil(defaultUntil(v));
              }}
              theme="dashboard"
            />
            <SofInput
              label="Horário (HH:MM)"
              value={time}
              onChangeText={setTime}
              theme="dashboard"
              placeholder="09:00"
            />

            {!isBlock ? (
              <ServicePicker
                services={services}
                serviceId={serviceId}
                onSelect={selectService}
              />
            ) : null}

            {!lockEmployeeId ? (
              <>
                <Text style={styles.label}>Profissional</Text>
                {!isBlock && !serviceId ? (
                  <Text style={styles.hint}>Escolha o serviço primeiro.</Text>
                ) : (!isBlock ? employeesForService : employees).length ===
                  0 ? (
                  <Text style={styles.hint}>
                    Nenhum profissional realiza este serviço.
                  </Text>
                ) : (
                  (isBlock ? employees : employeesForService).map((e) => (
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

            {isCreate ? (
              <>
                <Text style={styles.label}>Recorrência</Text>
                <View style={styles.rowChips}>
                  {FREQ_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        setFrequency(opt.id);
                        if (opt.id !== 'none' && date && !until) {
                          setUntil(defaultUntil(date));
                        }
                      }}
                      style={[
                        styles.chip,
                        styles.chipInline,
                        frequency === opt.id && styles.chipActive,
                      ]}
                    >
                      <Text>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {frequency !== 'none' ? (
                  <SofInput
                    label="Repetir até (AAAA-MM-DD)"
                    value={until}
                    onChangeText={setUntil}
                    theme="dashboard"
                  />
                ) : null}
              </>
            ) : inSeries ? (
              <Text style={styles.hint}>
                Esta ocorrência faz parte de uma série. A edição altera só este
                horário.
              </Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <SofButton
              title={loading ? 'Salvando…' : isCreate ? 'Salvar' : 'Salvar'}
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={loading}
            />
            {!isCreate ? (
              <>
                <SofButton
                  title={
                    isBlock ? 'Excluir evento' : 'Cancelar agendamento'
                  }
                  variant="danger"
                  theme="dashboard"
                  onPress={() => remove('one')}
                />
                {inSeries ? (
                  <SofButton
                    title="Excluir série inteira"
                    variant="danger"
                    theme="dashboard"
                    onPress={() => remove('series')}
                  />
                ) : null}
              </>
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
  rowChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    padding: 12,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    marginBottom: 6,
  },
  chipInline: { marginBottom: 0 },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  hint: { color: d.muted, fontSize: 14, marginBottom: 8 },
  error: { color: d.danger },
  actions: { gap: 10, marginTop: 8 },
});
