import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Appointment } from '@/src/api/types';
import { employeeApi } from '@/src/api/endpoints';
import { useEmployeeAuth } from '@/src/auth/EmployeeAuthProvider';
import { SofButton } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
  const { employee } = useEmployeeAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayStr = localDateStr(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { appointments: list } = await employeeApi.appointments();
      setAppointments(list.filter((a) => a.status === 'confirmed'));
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

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Minha agenda</Text>
          <Text style={styles.sub}>
            {weekDates[0].toLocaleDateString('pt-BR')} a{' '}
            {weekDates[6].toLocaleDateString('pt-BR')}
          </Text>
        </View>
        <View style={styles.toolbar}>
          <SofButton
            title="Semana anterior"
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
            title="Próxima"
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset((w) => w + 1)}
          />
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={d.muted} />
      ) : (
        <View style={styles.grid}>
          {weekDates.map((day) => {
            const ds = localDateStr(day);
            const items = forDay(ds);
            const isToday = ds === todayStr;
            return (
              <View
                key={ds}
                style={[styles.dayCol, isToday && styles.dayToday]}
              >
                <Text style={styles.dayTitle}>
                  {DOW[day.getDay()]} {pad(day.getDate())}/{pad(day.getMonth() + 1)}
                </Text>
                {items.length === 0 ? (
                  <Text style={styles.empty}>Sem horários</Text>
                ) : (
                  items.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setSelected(a)}
                      style={[
                        styles.card,
                        { borderLeftColor: employee.color },
                      ]}
                    >
                      <Text style={styles.time}>{a.time}</Text>
                      <Text style={styles.client}>{a.clientName}</Text>
                    </Pressable>
                  ))
                )}
              </View>
            );
          })}
        </View>
      )}

      {selected ? (
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>Agendamento</Text>
          <Text style={styles.detailLine}>
            {selected.date.split('-').reverse().join('/')} às {selected.time}
          </Text>
          <Text style={styles.detailLine}>Cliente: {selected.clientName}</Text>
          {selected.clientPhone ? (
            <Text style={styles.detailLine}>Tel: {selected.clientPhone}</Text>
          ) : null}
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
  sub: { color: d.muted, marginTop: 6 },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: '#dc2626', fontWeight: '600' },
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
  empty: { color: d.muted, fontSize: 12 },
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
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
