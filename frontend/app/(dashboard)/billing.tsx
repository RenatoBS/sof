import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatCurrency,
  useDashboard,
} from '@/src/context/DashboardContext';
import { d } from '@/src/theme/dashboard';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localDateStr(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function revenueFor(
  appointments: {
    status: string;
    date: string;
    price: number;
    kind?: string;
  }[],
  filter: 'day' | 'week' | 'month',
) {
  const confirmed = appointments.filter(
    (a) =>
      (a.status === 'scheduled' || a.status === 'completed') &&
      a.kind !== 'block',
  );
  const today = new Date();
  const todayStr = localDateStr(today);
  let filtered = confirmed;
  if (filter === 'day') {
    filtered = confirmed.filter((a) => a.date === todayStr);
  } else if (filter === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    filtered = confirmed.filter((a) => {
      const day = new Date(`${a.date}T00:00:00`);
      return day >= weekStart && day <= weekEnd;
    });
  } else {
    filtered = confirmed.filter((a) => {
      const day = new Date(`${a.date}T00:00:00`);
      return (
        day.getMonth() === today.getMonth() &&
        day.getFullYear() === today.getFullYear()
      );
    });
  }
  return filtered.reduce((sum, a) => sum + (a.price || 0), 0);
}

export default function BillingScreen() {
  const { appointments, getEmployee, getService } = useDashboard();

  const stats = useMemo(
    () => ({
      day: revenueFor(appointments, 'day'),
      week: revenueFor(appointments, 'week'),
      month: revenueFor(appointments, 'month'),
    }),
    [appointments],
  );

  const rows = appointments
    .filter(
      (a) =>
        (a.status === 'scheduled' || a.status === 'completed') &&
        a.kind !== 'block',
    )
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <View style={styles.page}>
      <View>
        <Text style={styles.h2}>Faturamento</Text>
        <Text style={styles.sub}>Acompanhe a receita de seus serviços</Text>
      </View>

      <View style={styles.statGrid}>
        {[
          { label: 'Hoje', value: stats.day },
          { label: 'Esta Semana', value: stats.week },
          { label: 'Este Mês', value: stats.month },
        ].map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statValue}>{formatCurrency(s.value)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Agendamentos</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>Nenhum agendamento confirmado</Text>
        ) : (
          rows.map((a) => {
            const [y, m, day] = a.date.split('-');
            return (
              <View key={a.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {day}/{m}/{y} · {a.time} · {a.clientName}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {getService(a.serviceId || '')?.name} ·{' '}
                    {getEmployee(a.employeeId)?.name || '—'} ·{' '}
                    {a.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
                  </Text>
                </View>
                <Text style={styles.rowPrice}>{formatCurrency(a.price)}</Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  stat: {
    backgroundColor: d.surface,
    padding: 24,
    borderRadius: d.radius,
    borderWidth: 2,
    borderColor: d.accent,
    minWidth: 240,
    flexGrow: 1,
    flexBasis: 240,
  },
  statLabel: { fontSize: 14, color: d.muted, fontWeight: '600', marginBottom: 12 },
  statValue: { fontSize: 32, fontWeight: '700', color: d.ink },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    overflow: 'hidden',
    paddingTop: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  empty: { padding: 32, textAlign: 'center', color: d.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  rowTitle: { fontSize: 14, color: d.ink, fontWeight: '500' },
  rowMeta: { fontSize: 12, color: d.muted, marginTop: 4 },
  rowPrice: { fontWeight: '700', fontSize: 14 },
});
