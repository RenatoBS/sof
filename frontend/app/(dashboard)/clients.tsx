import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
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
  const { clients, setClients } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pauseMode, setPauseMode] = useState<PauseMode>('off');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingId;

  const resetForm = () => {
    setName('');
    setPhone('');
    setPauseMode('off');
    setError('');
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
  };

  const startCreate = () => {
    setName('');
    setPhone('');
    setPauseMode('off');
    setError('');
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setPhone(client.phone);
    setPauseMode(pauseModeFromClient(client));
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    if (!phone.replace(/\D/g, '')) {
      setError('Informe o telefone do cliente.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
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
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Clientes</Text>
          <Text style={styles.sub}>
            Cadastre nome e telefone para vincular aos agendamentos
          </Text>
        </View>
        <SofButton
          title={showForm ? 'Cancelar' : 'Adicionar Cliente'}
          variant="dark"
          theme="dashboard"
          onPress={() => {
            if (showForm) resetForm();
            else startCreate();
          }}
        />
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </Text>
          <View style={styles.formGrid}>
            <SofInput
              label="Nome"
              value={name}
              onChangeText={setName}
              theme="dashboard"
              placeholder="Nome do cliente"
              autoCapitalize="words"
            />
            <SofInput
              label="Telefone"
              value={phone}
              onChangeText={setPhone}
              theme="dashboard"
              placeholder="11999990000"
              keyboardType="phone-pad"
            />
            {isEditing ? (
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
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SofButton
              title={
                loading
                  ? 'Salvando…'
                  : isEditing
                    ? 'Salvar alterações'
                    : 'Adicionar'
              }
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={loading}
            />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={resetForm}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        {clients.length === 0 ? (
          <Text style={styles.empty}>
            Nenhum cliente cadastrado ainda. Adicione manualmente ou aguarde o
            cadastro pelo WhatsApp.
          </Text>
        ) : (
          clients.map((c) => {
            const badge = pauseBadge(c);
            return (
              <View key={c.id} style={styles.entity}>
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
                  <Text style={styles.metaMuted}>Bot silencioso neste período</Text>
                ) : null}
                <View style={styles.cardActions}>
                  <Pressable onPress={() => startEdit(c)}>
                    <Text style={styles.edit}>Editar</Text>
                  </Pressable>
                  <Pressable onPress={() => remove(c.id)}>
                    <Text style={styles.delete}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: d.ink },
  formGrid: { gap: 12 },
  label: { fontWeight: '600', color: d.ink, fontSize: 14 },
  hint: { color: d.muted, fontSize: 13, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { color: d.ink, fontSize: 13 },
  chipTextActive: { fontWeight: '700' },
  error: { color: '#dc2626', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  empty: { color: d.muted, fontSize: 14 },
  entity: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 20,
    width: 280,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  name: { fontSize: 17, fontWeight: '700', color: d.ink },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgePermanent: {
    color: '#991b1b',
    backgroundColor: '#fee2e2',
  },
  meta: { color: d.muted, fontSize: 13 },
  metaMuted: { color: d.muted, fontSize: 12, fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  edit: { color: d.accent, fontWeight: '600' },
  delete: { color: '#dc2626', fontWeight: '600' },
});
