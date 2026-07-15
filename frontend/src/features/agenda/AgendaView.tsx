import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Appointment } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard, formatCurrency } from '@/src/context/DashboardContext';
import { SoftButton } from '@/src/components/ui';
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

export function AgendaView({
  onSelectAppointment,
}: {
  onSelectAppointment: (a: Appointment) => void;
}) {
  const { width } = useWindowDimensions();
  const colW = Math.max(110, Math.min(140, (width - 220) / 7));
  const { employees, appointments, getService, loadAll } = useDashboard();
  const [weekOffset, setWeekOffset] = useState(0);
  const [waPhone, setWaPhone] = useState('5511999990000');
  const [waMessage, setWaMessage] = useState('');
  const [waLog, setWaLog] = useState<{ dir: 'in' | 'out'; text: string }[]>(
    [],
  );
  const [waLoading, setWaLoading] = useState(false);
  const [waOn, setWaOn] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayStr = localDateStr(new Date());

  useEffect(() => {
    dashboardApi
      .integrations()
      .then((data) => setWaOn(data.whatsapp.configured))
      .catch(() => undefined);
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

  return (
    <View style={{ gap: 32 }}>
      <View style={styles.panelHead}>
        <View>
          <Text style={styles.h2}>Agenda Semanal</Text>
          <Text style={styles.sub}>
            {weekDates[0].toLocaleDateString('pt-BR')} a{' '}
            {weekDates[6].toLocaleDateString('pt-BR')} — clique em qualquer
            agendamento para editar
          </Text>
        </View>
        <View style={styles.toolbar}>
          <SoftButton
            title="Semana Anterior"
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset((w) => w - 1)}
          />
          <SoftButton
            title="Hoje"
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset(0)}
          />
          <SoftButton
            title="Próxima Semana"
            variant="light"
            theme="dashboard"
            onPress={() => setWeekOffset((w) => w + 1)}
          />
        </View>
      </View>

      {employees.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Nenhum profissional cadastrado ainda. Adicione um na aba Profissionais.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={styles.headerRow}>
              <View style={[styles.corner, { width: 150 }]}>
                <Text style={styles.headerText}>Profissional</Text>
              </View>
              {weekDates.map((day) => {
                const ds = localDateStr(day);
                const isToday = ds === todayStr;
                return (
                  <View
                    key={ds}
                    style={[
                      styles.dayHeader,
                      { width: colW },
                      isToday && styles.dayHeaderToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dow,
                        isToday && { color: '#fff' },
                      ]}
                    >
                      {DOW[day.getDay()]}
                    </Text>
                    <Text
                      style={[
                        styles.dom,
                        isToday && { color: '#fff' },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>

            {employees.map((emp) => (
              <View key={emp.id} style={styles.row}>
                <View
                  style={[
                    styles.empCell,
                    { width: 150, borderLeftColor: emp.color || d.accent },
                  ]}
                >
                  <Text style={styles.empName}>{emp.name}</Text>
                  <Text style={styles.specialty}>{emp.specialty}</Text>
                </View>
                {weekDates.map((day) => {
                  const ds = localDateStr(day);
                  const dayAppts = appointments
                    .filter((a) => a.employeeId === emp.id && a.date === ds)
                    .sort((a, b) => a.time.localeCompare(b.time));
                  return (
                    <View
                      key={ds}
                      style={[
                        styles.cell,
                        { width: colW, borderLeftColor: emp.color || d.accent },
                      ]}
                    >
                      {dayAppts.map((appt) => (
                        <Pressable
                          key={appt.id}
                          onPress={() => onSelectAppointment(appt)}
                          style={[
                            styles.appt,
                            appt.source === 'whatsapp' && styles.apptWa,
                          ]}
                        >
                          <Text style={styles.apptTime}>{appt.time}</Text>
                          <Text style={styles.apptClient}>{appt.clientName}</Text>
                          <Text style={styles.apptSvc}>
                            {getService(appt.serviceId)?.name}
                          </Text>
                          <Text style={styles.apptPrice}>
                            {formatCurrency(appt.price)}
                          </Text>
                          {appt.source === 'whatsapp' ? (
                            <Text style={styles.waBadge}>WhatsApp</Text>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bot do WhatsApp — simulador</Text>
        <Text style={styles.cardDesc}>
          Em produção, os agendamentos chegam de verdade pelo WhatsApp do cliente e
          caem aqui na hora.{' '}
          <Text style={[styles.waStatus, waOn ? styles.waOn : styles.waOff]}>
            {waOn ? 'conectado' : 'modo demo'}
          </Text>
        </Text>
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
        <View style={styles.waForm}>
          <TextInput
            style={styles.waInput}
            value={waPhone}
            onChangeText={setWaPhone}
            placeholder="Telefone do cliente"
          />
          <TextInput
            style={[styles.waInput, { flex: 1 }]}
            value={waMessage}
            onChangeText={setWaMessage}
            placeholder="Mensagem (ex.: oi)"
          />
          <SoftButton
            title={waLoading ? '…' : 'Enviar'}
            variant="dark"
            theme="dashboard"
            onPress={simulateWa}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
  },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  toolbar: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  empty: {
    backgroundColor: d.surface,
    padding: 48,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    alignItems: 'center',
  },
  emptyText: { color: d.muted },
  headerRow: { flexDirection: 'row', gap: 1, backgroundColor: d.line },
  corner: {
    backgroundColor: d.ink,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dayHeader: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    alignItems: 'center',
  },
  dayHeaderToday: { backgroundColor: d.ink },
  dow: { fontWeight: '600', fontSize: 14, color: d.ink },
  dom: { fontSize: 18, fontWeight: '700', marginTop: 4, color: d.ink },
  row: { flexDirection: 'row', gap: 1, backgroundColor: d.line },
  empCell: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderLeftWidth: 3,
  },
  empName: { fontWeight: '600', fontSize: 14 },
  specialty: { fontSize: 11, color: d.muted, marginTop: 4 },
  cell: {
    backgroundColor: '#fff',
    padding: 12,
    minHeight: 150,
    gap: 8,
    borderLeftWidth: 2,
  },
  appt: {
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: d.accent,
    padding: 8,
    borderRadius: d.radiusSm,
  },
  apptWa: { borderLeftColor: d.waGreen },
  apptTime: { fontWeight: '600', fontSize: 12 },
  apptClient: { color: '#475569', marginTop: 4, fontSize: 12 },
  apptSvc: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  apptPrice: { fontWeight: '600', marginTop: 4, fontSize: 12 },
  waBadge: {
    fontSize: 10,
    color: d.waGreenText,
    fontWeight: '700',
    marginTop: 4,
  },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 32,
    gap: 12,
  },
  cardTitle: { fontWeight: '600', fontSize: 16, marginBottom: 4 },
  cardDesc: { color: d.muted, fontSize: 14, marginBottom: 8 },
  waStatus: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  waOn: { color: d.waGreenText, backgroundColor: '#e7f9ef' },
  waOff: { color: '#94a3b8', backgroundColor: '#f1f5f9' },
  waLog: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    padding: 16,
    minHeight: 120,
    maxHeight: 280,
    gap: 8,
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 14,
  },
  bubbleOut: { backgroundColor: '#dcf8c6', alignSelf: 'flex-end' },
  bubbleIn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: d.line,
    alignSelf: 'flex-start',
  },
  waForm: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
  waInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: d.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    minWidth: 160,
    backgroundColor: '#fff',
  },
});
