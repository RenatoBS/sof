import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofPageHeader,
  SofRowActions,
} from '@/src/components/ui';
import { useEntitlements } from '@/src/entitlements/useEntitlements';
import {
  EntityAvatar,
  EntityCardBody,
  EntityCardFooter,
  EntityChip,
  EntityStat,
  entityCardStyles as ec,
} from '@/src/features/dashboard/EntityCard';
import { ClientFormModal } from '@/src/features/clients/ClientFormModal';
import { d } from '@/src/theme/dashboard';

function isClientBotPaused(client: Client) {
  if (client.botPausedPermanent) return true;
  if (!client.botPausedUntil) return false;
  const until = new Date(client.botPausedUntil);
  return !Number.isNaN(until.getTime()) && until.getTime() > Date.now();
}

function pauseBadge(
  client: Client,
): { label: string; tone: 'warn' | 'danger' } | null {
  if (client.botPausedPermanent) return { label: 'Bot desligado', tone: 'danger' };
  if (!client.botPausedUntil) return null;
  const until = new Date(client.botPausedUntil);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return null;
  }
  return {
    label: `Pausado até ${until.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    tone: 'warn',
  };
}

export default function ClientsScreen() {
  const { has } = useEntitlements();
  const { clients, setClients } = useDashboard();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const startCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const startEdit = (client: Client) => {
    setEditing(client);
    setModalOpen(true);
  };

  const onSaved = (client: Client) => {
    setClients((prev) => {
      const exists = prev.some((c) => c.id === client.id);
      const next = exists
        ? prev.map((c) => (c.id === client.id ? client : c))
        : [...prev, client];
      return next.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    });
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (editing?.id === id) closeModal();
  };

  return (
    <View style={ec.page}>
      <SofPageHeader
        title="Clientes"
        subtitle="Nome e telefone para vincular aos agendamentos"
        action={
          <SofButton
            title="Adicionar cliente"
            variant="dark"
            theme="dashboard"
            onPress={startCreate}
          />
        }
      />
      {clients.length > 0 ? (
        <Text style={ec.count}>
          {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
        </Text>
      ) : null}

      {clients.length === 0 ? (
        <SofCard padded={false}>
          <SofEmptyState
            title="Nenhum cliente ainda"
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
        <View style={ec.grid}>
          {clients.map((c) => {
            const badge = pauseBadge(c);
            return (
              <SofCard key={c.id} padded={false} style={ec.entity}>
                <EntityCardBody>
                  <View style={styles.head}>
                    <EntityAvatar name={c.name} color={d.accent} />
                    <View style={styles.headCopy}>
                      <Text style={styles.name} numberOfLines={2}>
                        {c.name}
                      </Text>
                      {/* Pausa automática aparece mesmo sem o gate: é estado
                          do sistema, não uma ação do dono. */}
                      {has('botPause') || badge ? (
                        <View style={styles.badgeRow}>
                          {badge ? (
                            <EntityChip tone={badge.tone}>{badge.label}</EntityChip>
                          ) : (
                            <EntityChip tone="ok">Bot ativo</EntityChip>
                          )}
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <EntityStat
                      label="Telefone"
                      value={formatPhone(c.phone) || '—'}
                    />
                  </View>
                  {isClientBotPaused(c) && !c.botPausedPermanent ? (
                    <Text style={styles.note}>
                      {c.botPausedAuto
                        ? 'Sof saiu da conversa — a equipe assumiu'
                        : 'Bot silencioso neste período'}
                    </Text>
                  ) : null}
                </EntityCardBody>
                <EntityCardFooter>
                  <SofRowActions
                    onEdit={() => startEdit(c)}
                    onRemove={() => remove(c.id)}
                  />
                </EntityCardFooter>
              </SofCard>
            );
          })}
        </View>
      )}

      <ClientFormModal
        visible={modalOpen}
        onClose={closeModal}
        client={editing}
        onSaved={onSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headCopy: { flex: 1, minWidth: 0, gap: 8 },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.2,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  note: {
    color: d.muted,
    fontSize: 12,
    fontFamily: d.fonts.body,
    fontStyle: 'italic',
  },
});
