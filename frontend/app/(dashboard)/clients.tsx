import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofErrorBanner,
  SofInput,
  SofPageHeader,
  SofRowActions,
} from '@/src/components/ui';
import { useEntitlements } from '@/src/entitlements/useEntitlements';
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

function isClientBotPaused(client: Client) {
  if (client.botPausedPermanent) return true;
  if (!client.botPausedUntil) return false;
  const until = new Date(client.botPausedUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
}

function pauseBadge(client: Client) {
  if (client.botPausedPermanent) return 'Bot off';
  if (!client.botPausedUntil) return null;
  const until = new Date(client.botPausedUntil);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return null;
  }
  return `Bot pausado até ${until.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function pauseModeFromClient(client: Client): PauseMode {
  if (client.botPausedPermanent) return 'permanent';
  if (!client.botPausedUntil) return 'off';
  const until = new Date(client.botPausedUntil);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return 'off';
  }
  return '24h'; // modo temporário genérico ao editar (usuário reescolhe o preset)
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

export default function ClientsScreen() {
  const { has } = useEntitlements();

  const { clients, setClients } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pauseMode, setPauseMode] = useState<PauseMode>('off');
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const isEditing = !!editingId;

  const clearField = (key: keyof ClientFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setPauseMode('off');
    setFieldErrors({});
    setError('');
    setTouched(false);
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
  };

  const startCreate = () => {
    setName('');
    setPhone('');
    setPauseMode('off');
    setFieldErrors({});
    setError('');
    setTouched(false);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setPhone(maskBrPhone(client.phone));
    setPauseMode(pauseModeFromClient(client));
    setFieldErrors({});
    setError('');
    setTouched(false);
    setShowForm(true);
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
      if (editingId) {
        const { client } = await dashboardApi.updateClient(editingId, {
          ...body,
          ...pausePayload(pauseMode),
        });
        setClients((prev) =>
          prev
            .map((c) => (c.id === client.id ? client : c))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
      } else {
        const { client } = await dashboardApi.createClient(body);
        setClients((prev) =>
          [...prev, client].sort((a, b) =>
            a.name.localeCompare(b.name, 'pt-BR'),
          ),
        );
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <View style={styles.page}>
      <SofPageHeader
        title="Clientes"
        subtitle="Cadastre nome e telefone para vincular aos agendamentos"
        action={
          <SofButton
            title={showForm ? 'Cancelar' : 'Adicionar cliente'}
            variant="dark"
            theme="dashboard"
            onPress={() => {
              if (showForm) resetForm();
              else startCreate();
            }}
          />
        }
      />

      {showForm ? (
        <SofCard>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar cliente' : 'Novo cliente'}
          </Text>
          <View style={styles.formGrid}>
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
                setPhone(maskBrPhone(t));
                clearField('phone');
              }}
              theme="dashboard"
              placeholder="(11) 99999-0000"
              keyboardType="phone-pad"
              error={touched ? fieldErrors.phone : undefined}
            />
            {isEditing && has('botPause') ? (
              <>
                <Text style={styles.label}>Bot WhatsApp</Text>
                <Text style={styles.hint}>
                  Desative para este cliente: o bot para de responder a conversa
                  (silêncio). Pode ser permanente ou por um tempo.
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
                          style={[
                            styles.chipText,
                            active && styles.chipTextActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
          {error ? <SofErrorBanner message={error} /> : null}
          <View style={styles.actions}>
            <SofButton
              title={isEditing ? 'Salvar alterações' : 'Adicionar'}
              variant="dark"
              theme="dashboard"
              onPress={save}
              loading={loading}
              disabled={loading}
            />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={resetForm}
            />
          </View>
        </SofCard>
      ) : null}

      {clients.length === 0 ? (
        <SofCard padded={false}>
          <SofEmptyState
            title="Nenhum cliente cadastrado ainda"
            body="Adicione manualmente ou aguarde o cadastro pelo WhatsApp."
            action={
              <SofButton
                title="Adicionar cliente"
                variant="dark"
                theme="dashboard"
                onPress={startCreate}
              />
            }
          />
        </SofCard>
      ) : (
        <View style={styles.grid}>
          {clients.map((c) => {
            const badge = pauseBadge(c);
            return (
              <SofCard key={c.id} style={styles.entity}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{c.name}</Text>
                  {badge ? (
                    <Text
                      style={[
                        styles.badge,
                        c.botPausedPermanent && styles.badgePermanent,
                      ]}
                    >
                      {badge}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.meta}>{formatPhone(c.phone)}</Text>
                {isClientBotPaused(c) && !c.botPausedPermanent ? (
                  <Text style={styles.metaMuted}>
                    Bot silencioso neste período
                  </Text>
                ) : null}
                <View style={styles.cardActions}>
                  <SofRowActions
                    onEdit={() => startEdit(c)}
                    onRemove={() => remove(c.id)}
                  />
                </View>
              </SofCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  cardTitle: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 16,
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  formGrid: { gap: 12 },
  label: {
    fontWeight: '600',
    color: d.mutedStrong,
    fontSize: 14,
    fontFamily: d.fonts.bodyMedium,
  },
  hint: { color: d.muted, fontSize: 13, lineHeight: 20, fontFamily: d.fonts.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    minWidth: 280,
    flexGrow: 1,
    flexBasis: 280,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    fontFamily: d.fonts.bodyMedium,
  },
  badgePermanent: {
    color: '#991b1b',
    backgroundColor: d.dangerSoft,
  },
  meta: { color: d.muted, fontSize: 13, fontFamily: d.fonts.body },
  metaMuted: {
    color: d.muted,
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: d.fonts.body,
  },
  cardActions: { marginTop: 4 },
});
