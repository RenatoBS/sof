import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { useEntitlements } from '@/src/entitlements/useEntitlements';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import {
  hasFieldErrors,
  maskBrPhone,
  normalizePhoneDigits,
  validateClientFields,
  type ClientFieldErrors,
} from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

type PauseMode = 'off' | 'permanent' | '1h' | '8h' | '24h' | '7d';

const PAUSE_PRESETS: { id: PauseMode; label: string; hours?: number }[] = [
  { id: 'off', label: 'Bot ativo' },
  { id: '1h', label: '1 hora', hours: 1 },
  { id: '8h', label: '8 horas', hours: 8 },
  { id: '24h', label: '24 horas', hours: 24 },
  { id: '7d', label: '7 dias', hours: 24 * 7 },
  { id: 'permanent', label: 'Permanente' },
];

function pauseModeFromClient(client: Client): PauseMode {
  if (client.botPausedPermanent) return 'permanent';
  if (!client.botPausedUntil) return 'off';
  const until = new Date(client.botPausedUntil);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return 'off';
  }
  return '24h';
}

function pausePayload(mode: PauseMode): {
  botPausedPermanent: boolean;
  botPausedUntil: string | null;
} {
  if (mode === 'off') {
    return { botPausedPermanent: false, botPausedUntil: null };
  }
  if (mode === 'permanent') {
    return { botPausedPermanent: true, botPausedUntil: null };
  }
  const preset = PAUSE_PRESETS.find((p) => p.id === mode);
  const hours = preset?.hours || 24;
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  return {
    botPausedPermanent: false,
    botPausedUntil: until.toISOString(),
  };
}

type ClientFormModalProps = {
  visible: boolean;
  onClose: () => void;
  client?: Client | null;
  onSaved: (client: Client) => void;
};

export function ClientFormModal({
  visible,
  onClose,
  client = null,
  onSaved,
}: ClientFormModalProps) {
  const { has } = useEntitlements();
  const isEditing = Boolean(client);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pauseMode, setPauseMode] = useState<PauseMode>('off');
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(client?.name || '');
    setPhone(client ? maskBrPhone(client.phone) : '');
    setPauseMode(client ? pauseModeFromClient(client) : 'off');
    setFieldErrors({});
    setError('');
    setTouched(false);
    setLoading(false);
  }, [visible, client]);

  const clearField = (key: keyof ClientFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const save = async () => {
    setError('');
    setTouched(true);
    const errors = validateClientFields({ name, phone });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        phone: normalizePhoneDigits(phone),
      };
      const { client: saved } = client
        ? await dashboardApi.updateClient(client.id, {
            ...body,
            ...pausePayload(pauseMode),
          })
        : await dashboardApi.createClient(body);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title={isEditing ? 'Editar cliente' : 'Novo cliente'}
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
      <SofInput
        label="Nome"
        value={name}
        onChangeText={(t) => {
          setName(t);
          clearField('name');
        }}
        theme="dashboard"
        placeholder="Nome do cliente"
        autoCapitalize="words"
        error={touched ? fieldErrors.name : undefined}
      />
      <SofInput
        label="Telefone"
        value={phone}
        onChangeText={(t) => {
          setPhone(t);
          clearField('phone');
        }}
        theme="dashboard"
        placeholder="(11) 99999-0000"
        mask="phone"
        error={touched ? fieldErrors.phone : undefined}
      />
      {isEditing && has('botPause') ? (
        <>
          <Text style={styles.label}>Bot WhatsApp</Text>
          <Text style={styles.hint}>
            Desative para este cliente: o bot para de responder (silêncio). Pode
            ser permanente ou por um tempo.
          </Text>
          <View style={styles.chips}>
            {PAUSE_PRESETS.map((p) => {
              const active = pauseMode === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPauseMode(p.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
      {error ? <SofErrorBanner message={error} /> : null}
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    color: d.mutedStrong,
    fontSize: 14,
    fontFamily: d.fonts.bodyMedium,
    marginTop: 8,
    marginBottom: 6,
  },
  hint: {
    color: d.muted,
    fontSize: 13,
    fontFamily: d.fonts.body,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: d.surface,
  },
  chipActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  chipText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  chipTextActive: { fontWeight: '700', fontFamily: d.fonts.bodyMedium },
});
