import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Appointment } from '@/src/api/types';
import { AgendaView } from '@/src/features/agenda/AgendaView';
import { AppointmentModal } from '@/src/features/appointments/AppointmentModal';

export default function AgendaScreen() {
  const [selected, setSelected] = useState<Appointment | null>(null);

  return (
    <View style={styles.page}>
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
  page: { flex: 1 },
});
