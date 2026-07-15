import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Appointment } from '@/src/api/types';
import { AgendaView } from '@/src/features/agenda/AgendaView';
import { AppointmentModal } from '@/src/features/appointments/AppointmentModal';
import { useAuth } from '@/src/auth/AuthProvider';
import { dashboardColors } from '@/src/theme/dashboard';

export default function AgendaScreen() {
  const { account } = useAuth();
  const [selected, setSelected] = useState<Appointment | null>(null);

  return (
    <View style={styles.page}>
      <Text style={styles.title}>{account?.businessName || 'Agenda'}</Text>
      <AgendaView onSelectAppointment={setSelected} />
      <AppointmentModal
        appointment={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: dashboardColors.bg },
  title: {
    fontSize: 20,
    fontWeight: '700',
    padding: 16,
    color: dashboardColors.ink,
  },
});
