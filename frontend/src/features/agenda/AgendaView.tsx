import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Appointment } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { Button } from '@/src/components/ui';
import { dashboardColors } from '@/src/theme/dashboard';

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
  return Array.from({ length: 7 }, (_, i) =>
    new Date(today.getFullYear(), today.getMonth(), first + i),
  );
}

export function AgendaView({
  onSelectAppointment,
}: {
  onSelectAppointment: (a: Appointment) => void;
}) {
  const { employees, appointments, getService, loadAll } = useDashboard();
  const [weekOffset, setWeekOffset] = useState(0);
  const [waPhone, setWaPhone] = useState('5511999990000');
  const [waMessage, setWaMessage] = useState('');
  const [waLog, setWaLog] = useState<{ dir: 'in' | 'out'; text: string }[]>(
    [],
  );
  const [waLoading, setWaLoading] = useState(false);
  const [integrations, setIntegrations] = useState({
    whatsapp: false,
    linked: '',
  });

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const refreshIntegrations = async () => {
    const data = await dashboardApi.integrations();
    setIntegrations({
      whatsapp: data.whatsapp.configured,
      linked: data.whatsapp.linkedPhoneNumberId,
    });
  };

  useEffect(() => {
    refreshIntegrations().catch(() => undefined);
  }, []);

  const simulateWa = async () => {
    if (!waMessage.trim()) return;
    setWaLog((l) => [...l, { dir: 'out', text: waMessage }]);
    setWaLoading(true);
    try {
      const data = await dashboardApi.simulateWhatsapp(waMessage, waPhone);
      setWaLog((l) => [
        ...l,
        ...data.replies.map((text) => ({ dir: 'in' as const, text })),
      ]);
      if (data.appointment) await loadAll();
      setWaMessage('');
    } finally {
      setWaLoading(false);
    }
  };

  if (employees.length === 0) {
    return (
      <Text style={styles.empty}>
        Cadastre profissionais e serviços para ver a agenda.
      </Text>
    );
  }

  return (
    <ScrollView style={styles.wrap}>
      <View style={styles.weekNav}>
        <Button title="◀" onPress={() => setWeekOffset((w) => w - 1)} variant="ghost" />
        <Text style={styles.weekLabel}>
          {weekDates[0].toLocaleDateString('pt-BR')} —{' '}
          {weekDates[6].toLocaleDateString('pt-BR')}
        </Text>
        <Button title="▶" onPress={() => setWeekOffset((w) => w + 1)} variant="ghost" />
        <Button title="Hoje" onPress={() => setWeekOffset(0)} variant="ghost" />
      </View>

      {employees.map((emp) => (
        <View key={emp.id} style={styles.empBlock}>
          <Text style={[styles.empName, { color: emp.color }]}>{emp.name}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.grid}>
              {weekDates.map((d) => {
                const dateStr = localDateStr(d);
                const dayAppts = appointments
                  .filter(
                    (a) => a.employeeId === emp.id && a.date === dateStr,
                  )
                  .sort((a, b) => a.time.localeCompare(b.time));
                return (
                  <View key={dateStr} style={styles.dayCol}>
                    <Text style={styles.dayHead}>
                      {DOW[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}
                    </Text>
                    {dayAppts.map((appt) => (
                      <Pressable
                        key={appt.id}
                        style={[
                          styles.appt,
                          appt.source === 'whatsapp' && styles.apptWa,
                        ]}
                        onPress={() => onSelectAppointment(appt)}
                      >
                        <Text style={styles.apptTime}>{appt.time}</Text>
                        <Text style={styles.apptClient}>{appt.clientName}</Text>
                        <Text style={styles.apptSvc}>
                          {getService(appt.serviceId)?.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}

      <View style={styles.waBox}>
        <Text style={styles.waTitle}>Simulador WhatsApp</Text>
        <Text style={styles.waStatus}>
          Bot: {integrations.whatsapp ? 'configurado' : 'demo'} | Phone ID:{' '}
          {integrations.linked || 'não vinculado'}
        </Text>
        <TextInput
          style={styles.waInput}
          value={waPhone}
          onChangeText={setWaPhone}
          placeholder="Telefone"
        />
        <View style={styles.waLog}>
          {waLog.map((b, i) => (
            <Text
              key={i}
              style={[
                styles.bubble,
                b.dir === 'out' ? styles.bubbleOut : styles.bubbleIn,
              ]}
            >
              {b.text}
            </Text>
          ))}
        </View>
        <TextInput
          style={styles.waInput}
          value={waMessage}
          onChangeText={setWaMessage}
          placeholder="Mensagem"
        />
        <Button
          title={waLoading ? '…' : 'Enviar'}
          onPress={simulateWa}
          variant="accent"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  empty: { color: dashboardColors.muted, padding: 16 },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    flexWrap: 'wrap',
  },
  weekLabel: { fontWeight: '600', color: dashboardColors.ink },
  empBlock: { marginBottom: 16, paddingHorizontal: 12 },
  empName: { fontWeight: '700', marginBottom: 8 },
  grid: { flexDirection: 'row', gap: 8 },
  dayCol: {
    width: 120,
    backgroundColor: dashboardColors.card,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: dashboardColors.line,
  },
  dayHead: { fontWeight: '600', marginBottom: 8, fontSize: 12 },
  appt: {
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: dashboardColors.accent,
  },
  apptWa: { borderLeftColor: dashboardColors.waGreen },
  apptTime: { fontWeight: '700', fontSize: 12 },
  apptClient: { fontSize: 12 },
  apptSvc: { fontSize: 11, color: dashboardColors.muted },
  waBox: {
    margin: 12,
    padding: 12,
    backgroundColor: dashboardColors.card,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: dashboardColors.line,
  },
  waTitle: { fontWeight: '700' },
  waStatus: { color: dashboardColors.muted, fontSize: 12 },
  waInput: {
    borderWidth: 1,
    borderColor: dashboardColors.line,
    borderRadius: 8,
    padding: 10,
  },
  waLog: { minHeight: 80, gap: 6 },
  bubble: { padding: 8, borderRadius: 8, maxWidth: '90%' },
  bubbleOut: { alignSelf: 'flex-end', backgroundColor: '#dcf8c6' },
  bubbleIn: { alignSelf: 'flex-start', backgroundColor: '#fff' },
});
