import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  formatCurrency,
  useDashboard,
} from '@/src/context/DashboardContext';
import { dashboardColors } from '@/src/theme/dashboard';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localDateStr(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function revenueFor(
  appointments: { status: string; date: string; price: number }[],
  filter: 'day' | 'week' | 'month',
) {
  const confirmed = appointments.filter((a) => a.status === 'confirmed');
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
      const d = new Date(`${a.date}T00:00:00`);
      return d >= weekStart && d <= weekEnd;
    });
  } else {
    filtered = confirmed.filter((a) => {
      const d = new Date(`${a.date}T00:00:00`);
      return (
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
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
    .filter((a) => a.status === 'confirmed')
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <ScrollView style={styles.page}>
      <Text style={styles.title}>Faturamento</Text>
      <View style={styles.stats}>
        <Text>Hoje: {formatCurrency(stats.day)}</Text>
        <Text>Semana: {formatCurrency(stats.week)}</Text>
        <Text>Mês: {formatCurrency(stats.month)}</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>Nenhum agendamento confirmado</Text>
      ) : (
        rows.map((a) => {
          const [y, m, d] = a.date.split('-');
          return (
            <View key={a.id} style={styles.row}>
              <Text>
                {d}/{m}/{y} {a.time} — {a.clientName}
              </Text>
              <Text style={styles.meta}>
                {getService(a.serviceId)?.name} · {getEmployee(a.employeeId)?.name} ·{' '}
                {a.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
              </Text>
              <Text style={styles.price}>{formatCurrency(a.price)}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: dashboardColors.bg, padding: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  stats: { gap: 6, marginBottom: 16 },
  empty: { color: dashboardColors.muted },
  row: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: dashboardColors.line,
  },
  meta: { color: dashboardColors.muted, fontSize: 12 },
  price: { fontWeight: '700', marginTop: 4 },
});
