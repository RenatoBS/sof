import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '@/src/api/client';
import { dashboardApi, employeeTicketsApi } from '@/src/api/endpoints';
import type {
  SupportTicket,
  SupportTicketStatus,
} from '@/src/api/types';
import { SofButton, SofInput } from '@/src/components/ui';
import { useEntitlements } from '@/src/entitlements/useEntitlements';
import { d } from '@/src/theme/dashboard';

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const STATUSES: SupportTicketStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'closed',
];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Mode = 'account' | 'employee';

export function SupportTicketsPanel({ mode }: { mode: Mode }) {
  const { has } = useEntitlements();
  const api =
    mode === 'employee'
      ? {
          list: employeeTicketsApi.list,
          get: employeeTicketsApi.get,
          create: employeeTicketsApi.create,
          comment: employeeTicketsApi.comment,
          updateStatus: employeeTicketsApi.updateStatus,
        }
      : {
          list: dashboardApi.tickets,
          get: dashboardApi.ticket,
          create: dashboardApi.createTicket,
          comment: dashboardApi.commentTicket,
          updateStatus: dashboardApi.updateTicketStatus,
        };

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.list();
      setTickets(res.tickets);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar tickets.');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  const loadDetail = useCallback(
    async (id: string) => {
      setError('');
      try {
        const res = await api.get(id);
        setDetail(res.ticket);
        setSelectedId(id);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Falha ao abrir ticket.');
      }
    },
    [mode],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  async function onCreate() {
    setBusy(true);
    setError('');
    try {
      const res = await api.create({
        title: title.trim(),
        description: description.trim(),
      });
      setTitle('');
      setDescription('');
      setCreating(false);
      await loadList();
      await loadDetail(res.ticket.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao criar ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function onComment() {
    if (!selectedId || !comment.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.comment(selectedId, comment.trim());
      setComment('');
      await loadDetail(selectedId);
      await loadList();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao comentar.');
    } finally {
      setBusy(false);
    }
  }

  async function onStatus(status: SupportTicketStatus) {
    if (!selectedId) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.updateStatus(selectedId, status);
      setDetail(res.ticket);
      await loadList();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao atualizar status.');
    } finally {
      setBusy(false);
    }
  }

  if (selectedId && detail) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <SofButton
          title="← Tickets"
          variant="light"
          theme="dashboard"
          onPress={() => {
            setSelectedId(null);
            setDetail(null);
          }}
        />
        <Text style={styles.title}>{detail.title}</Text>
        <Text style={styles.meta}>
          {STATUS_LABEL[detail.status] || detail.status} ·{' '}
          {detail.createdByName} · {formatWhen(detail.createdAt)}
        </Text>
        <Text style={styles.body}>{detail.description}</Text>

        <Text style={styles.section}>Status</Text>
        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <SofButton
              key={s}
              title={STATUS_LABEL[s]}
              theme="dashboard"
              variant={detail.status === s ? 'dark' : 'light'}
              disabled={busy}
              onPress={() => onStatus(s)}
            />
          ))}
        </View>

        <Text style={styles.section}>Comentários</Text>
        {(detail.comments || []).length === 0 ? (
          <Text style={styles.empty}>Nenhum comentário ainda.</Text>
        ) : (
          detail.comments!.map((c) => (
            <View key={c.id} style={styles.comment}>
              <Text style={styles.commentAuthor}>
                {c.authorName}
                {c.authorRole === 'admin' ? ' · Sof' : ''}
                {' · '}
                {formatWhen(c.createdAt)}
              </Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          ))
        )}

        <SofInput
          label="Novo comentário"
          theme="dashboard"
          value={comment}
          onChangeText={setComment}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <SofButton
          title={busy ? 'Enviando…' : 'Enviar comentário'}
          theme="dashboard"
          variant="dark"
          disabled={busy || !comment.trim()}
          onPress={onComment}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>
            Suporte
            {mode === 'account' && has('supportPriority') ? ' · Prioritário' : ''}
          </Text>
          <Text style={styles.meta}>
            {mode === 'account'
              ? has('supportPriority')
                ? 'Seu plano inclui suporte prioritário. Abra um ticket e converse com a equipe Sof.'
                : 'Abra um ticket e converse com a equipe Sof.'
              : 'Acompanhe e responda os tickets do estabelecimento.'}
          </Text>
        </View>
        {mode === 'account' ? (
          <SofButton
            title={creating ? 'Cancelar' : 'Novo ticket'}
            theme="dashboard"
            variant={creating ? 'light' : 'dark'}
            onPress={() => setCreating((v) => !v)}
          />
        ) : null}
      </View>

      {creating && mode === 'account' ? (
        <View style={styles.form}>
          <SofInput
            label="Título"
            theme="dashboard"
            value={title}
            onChangeText={setTitle}
          />
          <SofInput
            label="Descrição"
            theme="dashboard"
            value={description}
            onChangeText={setDescription}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />
          <SofButton
            title={busy ? 'Criando…' : 'Abrir ticket'}
            theme="dashboard"
            variant="dark"
            disabled={busy || !title.trim() || !description.trim()}
            onPress={onCreate}
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={d.muted} style={{ marginTop: 24 }} />
      ) : tickets.length === 0 ? (
        <Text style={styles.empty}>Nenhum ticket ainda.</Text>
      ) : (
        tickets.map((t) => (
          <Pressable
            key={t.id}
            style={styles.row}
            onPress={() => loadDetail(t.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.title}</Text>
              <Text style={styles.meta}>
                {t.createdByName} · {formatWhen(t.updatedAt)} ·{' '}
                {t.commentCount} comentário(s)
              </Text>
            </View>
            <Text style={styles.badge}>
              {STATUS_LABEL[t.status] || t.status}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 48, gap: 16 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: d.ink,
  },
  meta: { color: d.muted, marginTop: 4, fontSize: 14 },
  body: { color: d.ink, fontSize: 15, lineHeight: 22 },
  section: {
    fontSize: 13,
    fontWeight: '600',
    color: d.muted,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  form: {
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 12,
    padding: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 12,
    padding: 16,
  },
  rowTitle: { fontSize: 16, fontWeight: '600', color: d.ink },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: d.accent || '#0f766e',
    textTransform: 'uppercase',
  },
  comment: {
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 10,
    padding: 12,
  },
  commentAuthor: { fontSize: 12, color: d.muted, marginBottom: 4 },
  commentBody: { color: d.ink, fontSize: 14, lineHeight: 20 },
  empty: { color: d.muted, marginTop: 8 },
  error: { color: d.danger },
});
