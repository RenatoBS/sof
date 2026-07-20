import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Appointment, Client, Service } from '@/src/api/types';
import { employeeApi } from '@/src/api/endpoints';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import {
  AppointmentModal,
  type AppointmentDraft,
} from '@/src/features/appointments/AppointmentModal';
import { SofButton } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const COMPACT_BREAKPOINT = 720;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localDateStr(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getWeekDates(offset: number) {
  const today = new Date();
  const first = today.getDate() - today.getDay() + offset * 7;
  return Array.from(
    { length: 7 },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), first + i),
  );
}

export default function ProfissionalAgendaScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const { employee } = useEmployeeAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() =>
    localDateStr(new Date()),
  );
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [createDraft, setCreateDraft] = useState<AppointmentDraft | null>(
    null,
  );
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayStr = localDateStr(new Date());

  useEffect(() => {
    const inWeek = weekDates.some((day) => localDateStr(day) === selectedDate);
    if (inWeek) return;
    const todayInWeek = weekDates.find(
      (day) => localDateStr(day) === todayStr,
    );
    setSelectedDate(localDateStr(todayInWeek || weekDates[0]));
  }, [weekDates, selectedDate, todayStr]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, clientsRes, servicesRes] = await Promise.all([
        employeeApi.appointments(),
        employeeApi.clients(),
        employeeApi.services(),
      ]);
      setAppointments(
        appts.appointments.filter((a) => a.status === 'confirmed'),
      );
      setClients(clientsRes.clients);
      setServices(servicesRes.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar agenda');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const forDay = (dateStr: string) =>
    appointments
      .filter((a) => a.date === dateStr)
      .sort((a, b) => a.time.localeCompare(b.time));

  const cancel = async () => {
    if (!selected) return;
    setCancelling(true);
    setError('');
    try {
      await employeeApi.cancelAppointment(selected.id);
      setAppointments((prev) => prev.filter((a) => a.id !== selected.id));
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally {
      setCancelling(false);
    }
  };

  if (!employee) return null;

  const employeesScoped = [
    {
      id: employee.id,
      accountId: employee.accountId,
      name: employee.name,
      email: employee.email,
      mustChangePassword: employee.mustChangePassword,
      color: employee.color,
      services,
      createdAt: employee.createdAt,
    },
  ];

  const closeModal = () => {
    setCreateDraft(null);
  };

  const selectedDayItems = forDay(selectedDate);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.h2, isCompact && styles.h2Compact]}>
            Minha agenda
          </Text>
          <Text style={styles.sub}>
            {weekDates[0].toLocaleDateString('pt-BR')} a{' '}
            {weekDates[6].toLocaleDateString('pt-BR')}
            {isCompact ? ' — escolha o dia' : ' — clique no dia para agendar'}
          </Text>
        </View>
        <View style={styles.toolbar}>
          <SofButton
            title={isCompact ? 'Ant.' : 'Semana anterior'}
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset((w) => w - 1)}
          />
          <SofButton
            title="Hoje"
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset(0)}
          />
          <SofButton
            title={isCompact ? 'Próx.' : 'Próxima'}
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset((w) => w + 1)}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={d.muted} />
      ) : isCompact ? (
        <View style={styles.compactRoot}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStrip}
          >
            {weekDates.map((day) => {
              const ds = localDateStr(day);
              const isToday = ds === todayStr;
              const active = ds === selectedDate;
              const count = forDay(ds).length;
              return (
                <Pressable
                  key={ds}
                  onPress={() => setSelectedDate(ds)}
                  style={[
                    styles.dayChip,
                    isToday && !active && styles.dayChipToday,
                    active && styles.dayChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayChipDow,
                      active && styles.dayChipTextActive,
                    ]}
                  >
                    {DOW[day.getDay()]}
                  </Text>
                  <Text
                    style={[
                      styles.dayChipDom,
                      active && styles.dayChipTextActive,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {count > 0 ? (
                    <Text
                      style={[
                        styles.dayChipCount,
                        active && styles.dayChipTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  ) : (
                    <Text style={styles.dayChipCountPlaceholder}> </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.dayPanel}>
            <View style={styles.dayPanelHead}>
              <Text style={styles.dayPanelTitle}>
                {DOW[new Date(selectedDate + 'T12:00:00').getDay()]}{' '}
                {selectedDate.split('-').reverse().join('/')}
              </Text>
              <SofButton
                title="+ Agendar"
                variant="light"
                theme="dashboard"
                onPress={() => {
                  setSelected(null);
                  setCreateDraft({
                    employeeId: employee.id,
                    date: selectedDate,
                  });
                }}
              />
            </View>
            {selectedDayItems.length === 0 ? (
              <Pressable
                onPress={() => {
                  setSelected(null);
                  setCreateDraft({
                    employeeId: employee.id,
                    date: selectedDate,
                  });
                }}
                style={styles.compactEmpty}
              >
                <Text style={styles.empty}>Livre — toque para agendar</Text>
              </Pressable>
            ) : (
              selectedDayItems.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setCreateDraft(null);
                    setSelected(a);
                  }}
                  style={[styles.card, { borderLeftColor: employee.color }]}
                >
                  <Text style={styles.time}>{a.time}</Text>
                  <Text style={styles.client}>
                    {a.kind === 'block' ? a.title || 'Evento' : a.clientName}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      ) : (
        <View style={styles.grid}>
          {weekDates.map((day) => {
            const ds = localDateStr(day);
            const items = forDay(ds);
            const isToday = ds === todayStr;
            return (
              <Pressable
                key={ds}
                onPress={() => {
                  setSelected(null);
                  setCreateDraft({
                    employeeId: employee.id,
                    date: ds,
                  });
                }}
                style={[styles.dayCol, isToday && styles.dayToday]}
              >
                <Text style={styles.dayTitle}>
                  {DOW[day.getDay()]} {pad(day.getDate())}/
                  {pad(day.getMonth() + 1)}
                </Text>
                {items.length === 0 ? (
                  <Text style={styles.empty}>+ Agendar</Text>
                ) : (
                  items.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        setCreateDraft(null);
                        setSelected(a);
                      }}
                      style={[
                        styles.card,
                        { borderLeftColor: employee.color },
                      ]}
                    >
                      <Text style={styles.time}>{a.time}</Text>
                      <Text style={styles.client}>
                        {a.kind === 'block'
                          ? a.title || 'Evento'
                          : a.clientName}
                      </Text>
                    </Pressable>
                  ))
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            {selected.kind === 'block' ? 'Evento' : 'Agendamento'}
          </Text>
          <Text style={styles.detailLine}>
            {selected.date.split('-').reverse().join('/')} às {selected.time}
          </Text>
          {selected.kind === 'block' ? (
            <Text style={styles.detailLine}>
              {selected.title}
              {selected.durationMinutes
                ? ` · ${selected.durationMinutes} min`
                : ''}
            </Text>
          ) : (
            <>
              <Text style={styles.detailLine}>
                Cliente: {selected.clientName}
              </Text>
              {selected.clientPhone ? (
                <Text style={styles.detailLine}>
                  Tel: {selected.clientPhone}
                </Text>
              ) : null}
            </>
          )}
          <View style={styles.detailActions}>
            <SofButton
              title={cancelling ? 'Cancelando…' : 'Cancelar agendamento'}
              variant="danger"
              theme="dashboard"
              disabled={cancelling}
              onPress={cancel}
            />
            <SofButton
              title="Fechar"
              variant="light"
              theme="dashboard"
              onPress={() => setSelected(null)}
            />
          </View>
        </View>
      ) : null}

      <AppointmentModal
        mode="create"
        visible={!!createDraft}
        initial={createDraft}
        lockEmployeeId={employee.id}
        clients={clients}
        services={services}
        employees={employeesScoped}
        onClose={closeModal}
        onClientCreated={(client) =>
          setClients((prev) =>
            [...prev.filter((c) => c.id !== client.id), client].sort((a, b) =>
              a.name.localeCompare(b.name, 'pt-BR'),
            ),
          )
        }
        onSaved={(appointment, series) => {
          const list = series?.length ? series : [appointment];
          setAppointments((prev) => {
            const ids = new Set(list.map((a) => a.id));
            return [...prev.filter((a) => !ids.has(a.id)), ...list];
          });
        }}
        createAppointment={(body) => employeeApi.createAppointment(body)}
        createClient={async (body) => employeeApi.createClient(body)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24, paddingBottom: 48, maxWidth: 1100 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  h2: { fontSize: 28, fontWeight: '700', color: d.ink },
  h2Compact: { fontSize: 22 },
  sub: { color: d.muted, marginTop: 6 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: '#dc2626', fontWeight: '600' },
  compactRoot: { gap: 16 },
  dayStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 8,
  },
  dayChip: {
    width: 56,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: d.radiusSm,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    gap: 2,
  },
  dayChipToday: {
    borderWidth: 1,
    borderColor: d.accent,
  },
  dayChipActive: {
    backgroundColor: d.ink,
  },
  dayChipDow: {
    fontSize: 11,
    fontWeight: '600',
    color: d.muted,
  },
  dayChipDom: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
  },
  dayChipCount: {
    fontSize: 10,
    fontWeight: '700',
    color: d.accent,
    marginTop: 2,
  },
  dayChipCountPlaceholder: {
    fontSize: 10,
    marginTop: 2,
  },
  dayChipTextActive: {
    color: '#fff',
  },
  dayPanel: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 14,
    gap: 10,
  },
  dayPanelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dayPanelTitle: {
    fontWeight: '700',
    color: d.ink,
    fontSize: 15,
    flex: 1,
  },
  compactEmpty: {
    paddingVertical: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayCol: {
    flexGrow: 1,
    flexBasis: 120,
    minWidth: 120,
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 12,
    gap: 8,
    minHeight: 180,
  },
  dayToday: { borderColor: d.accent },
  dayTitle: { fontWeight: '700', color: d.ink, fontSize: 13 },
  empty: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    gap: 2,
  },
  time: { fontWeight: '700', color: d.ink, fontSize: 13 },
  client: { color: d.muted, fontSize: 12 },
  detail: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 20,
    gap: 8,
    maxWidth: 420,
  },
  detailTitle: { fontSize: 18, fontWeight: '700', color: d.ink },
  detailLine: { color: d.ink, fontSize: 14 },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
});
