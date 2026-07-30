import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DaySchedule, OpeningHours } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { SofButton, SofInput } from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import { isValidTimeHm } from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

const DAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const DEFAULT_HOURS: OpeningHours = [
  { open: false, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
  { open: true, start: '09:00', end: '18:00' },
];

export function normalizeOpeningHours(
  raw: OpeningHours | undefined | null,
): OpeningHours {
  if (!Array.isArray(raw) || raw.length !== 7) {
    return DEFAULT_HOURS.map((day) => ({ ...day }));
  }
  return raw.map((day, idx) => ({
    open: Boolean(day?.open),
    start: day?.start || DEFAULT_HOURS[idx].start,
    end: day?.end || DEFAULT_HOURS[idx].end,
  }));
}

type OpeningHoursModalProps = {
  visible: boolean;
  onClose: () => void;
  initialHours: OpeningHours;
  onSaved: (hours: OpeningHours) => void;
};

export function OpeningHoursModal({
  visible,
  onClose,
  initialHours,
  onSaved,
}: OpeningHoursModalProps) {
  const [hours, setHours] = useState<OpeningHours>(() =>
    normalizeOpeningHours(initialHours),
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setHours(normalizeOpeningHours(initialHours));
    setError('');
    setLoading(false);
  }, [visible, initialHours]);

  const patchDay = (index: number, patch: Partial<DaySchedule>) => {
    setHours((prev) =>
      prev.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
  };

  const save = async () => {
    setError('');
    for (let i = 0; i < hours.length; i += 1) {
      const day = hours[i];
      if (!day.open) continue;
      if (!isValidTimeHm(day.start) || !isValidTimeHm(day.end)) {
        setError(
          `${DAY_LABELS[i]}: use horários no formato HH:mm (ex.: 09:00).`,
        );
        return;
      }
      if (day.start >= day.end) {
        setError(
          `${DAY_LABELS[i]}: o horário de abertura deve ser antes do fechamento.`,
        );
        return;
      }
    }
    setLoading(true);
    try {
      const { account: updated } = await dashboardApi.updateAccount({
        openingHours: hours,
      });
      onSaved(normalizeOpeningHours(updated.openingHours));
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title="Horário de funcionamento"
      hint="O serviço precisa caber inteiro dentro do expediente."
      actions={
        <>
          <SofButton
            title={loading ? 'Salvando…' : 'Salvar'}
            variant="dark"
            theme="dashboard"
            onPress={save}
            loading={loading}
            disabled={loading}
          />
          <SofButton
            title="Fechar"
            variant="light"
            theme="dashboard"
            onPress={onClose}
            disabled={loading}
          />
        </>
      }
    >
      {hours.map((day, index) => (
        <View key={DAY_LABELS[index]} style={styles.dayRow}>
          <View style={styles.dayHead}>
            <Text style={styles.dayLabel}>{DAY_LABELS[index]}</Text>
            <Pressable
              onPress={() => patchDay(index, { open: !day.open })}
              style={[
                styles.toggle,
                day.open ? styles.toggleOn : styles.toggleOff,
              ]}
            >
              <Text style={styles.toggleText}>
                {day.open ? 'Aberto' : 'Fechado'}
              </Text>
            </Pressable>
          </View>
          {day.open ? (
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <SofInput
                  label="Abre"
                  value={day.start}
                  onChangeText={(start) => patchDay(index, { start })}
                  theme="dashboard"
                  placeholder="09:00"
                />
              </View>
              <View style={styles.timeField}>
                <SofInput
                  label="Fecha"
                  value={day.end}
                  onChangeText={(end) => patchDay(index, { end })}
                  theme="dashboard"
                  placeholder="18:00"
                />
              </View>
            </View>
          ) : null}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  dayRow: {
    borderTopWidth: 1,
    borderTopColor: d.line,
    paddingTop: 12,
    marginTop: 4,
    gap: 8,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dayLabel: {
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  toggle: {
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toggleOn: { backgroundColor: d.accentSoft },
  toggleOff: { backgroundColor: d.fill },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  timeRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  timeField: { flexGrow: 1, flexBasis: 120, minWidth: 110 },
  error: { color: d.danger, marginTop: 8, fontFamily: d.fonts.body },
});
