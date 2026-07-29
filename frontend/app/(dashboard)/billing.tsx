import { useMemo } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import {
  formatCurrency,
  useDashboard,
} from '@/src/context/DashboardContext';
import { SofCard, SofEmptyState, SofPageHeader } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';
import { useEntitlements } from '@/src/entitlements/useEntitlements';

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
  const total = filtered.reduce((sum, a) => sum + (a.price || 0), 0);
  const count = filtered.length;
  return { total, count, average: count > 0 ? total / count : 0 };
}

export default function BillingScreen() {
  const { has } = useEntitlements();
  const { appointments, getEmployee, getService } = useDashboard();

  const stats = useMemo(
    () => ({
      day: revenueFor(appointments, 'day'),
      week: revenueFor(appointments, 'week'),
      month: revenueFor(appointments, 'month'),
    }),
    [appointments],
  );

  if (!has('billing')) return <Redirect href="/(dashboard)/agenda" />;

  const rows = appointments
    .filter(
      (a) =>
        (a.status === 'scheduled' || a.status === 'completed') &&
        a.kind !== 'block',
    )
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Faturamento"
        subtitle="Acompanhe a receita de seus serviços"
      />

      <View style={styles.statGrid}>
        {[
          { label: 'Hoje', value: stats.day.total },
          { label: 'Esta semana', value: stats.week.total },
          { label: 'Este mês', value: stats.month.total },
          {
            label: 'Ticket médio (mês)',
            value: stats.month.average,
            hint:
              stats.month.count > 0
                ? `${stats.month.count} agendamento${stats.month.count === 1 ? '' : 's'}`
                : 'Sem agendamentos no mês',
          },
        ].map((s) => (
          <SofCard key={s.label} style={styles.stat}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statValue}>{formatCurrency(s.value)}</Text>
            {'hint' in s && s.hint ? (
              <Text style={styles.statHint}>{s.hint}</Text>
            ) : null}
          </SofCard>
        ))}
      </View>

      <SofCard padded={false} style={styles.card}>
        <Text style={styles.cardTitle}>Agendamentos</Text>
        {rows.length === 0 ? (
          <SofEmptyState title="Nenhum agendamento confirmado" />
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
      </SofCard>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  stat: {
    borderWidth: 2,
    borderColor: d.accent,
    minWidth: 240,
    flexGrow: 1,
    flexBasis: 240,
  },
  statLabel: {
    fontSize: 14,
    color: d.muted,
    fontWeight: '600',
    marginBottom: 12,
    fontFamily: d.fonts.bodyMedium,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
  },
  statHint: { fontSize: 12, color: d.muted, marginTop: 8, fontFamily: d.fonts.body },
  card: { overflow: 'hidden', paddingTop: 8 },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
    gap: 12,
  },
  rowTitle: {
    fontSize: 14,
    color: d.ink,
    fontWeight: '500',
    fontFamily: d.fonts.body,
  },
  rowMeta: { fontSize: 12, color: d.muted, marginTop: 4, fontFamily: d.fonts.body },
  rowPrice: {
    fontWeight: '700',
    fontSize: 14,
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
});
