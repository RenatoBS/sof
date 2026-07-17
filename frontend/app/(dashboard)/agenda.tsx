import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Appointment } from '@/src/api/types';
import { AgendaView } from '@/src/features/agenda/AgendaView';
import {
  AppointmentModal,
  type AppointmentDraft,
} from '@/src/features/appointments/AppointmentModal';

export default function AgendaScreen() {
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [createDraft, setCreateDraft] = useState<AppointmentDraft | null>(
    null,
  );

  const close = () => {
    setSelected(null);
    setCreateDraft(null);
  };

  return (
    <View style={styles.page}>
      <AgendaView
        onSelectAppointment={(appt) => {
          setCreateDraft(null);
          setSelected(appt);
        }}
        onCreateAppointment={(draft) => {
          setSelected(null);
          setCreateDraft(draft);
        }}
      />
      <AppointmentModal
        mode={createDraft ? 'create' : 'edit'}
        appointment={selected}
        initial={createDraft}
        visible={!!selected || !!createDraft}
        onClose={close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
