import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import {
  ticketsApi,
  type TicketRow,
  type TicketStatus,
} from '@/src/api/endpoints';
import { Button, ErrorText, Field } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const STATUSES: TicketStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'closed',
];

function paramId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

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

export default function EditTicketScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = paramId(params.id);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setError('Ticket inválido.');
      return;
    }
    const res = await ticketsApi.get(id);
    setTicket(res.ticket);
  }, [id]);

  useEffect(() => {
    load().catch((e) =>
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar.'),
    );
  }, [load]);

  async function onComment() {
    if (!id || !comment.trim()) return;
    setBusy(true);
    setError('');
    try {
      await ticketsApi.comment(id, comment.trim());
      setComment('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao comentar.');
    } finally {
      setBusy(false);
    }
  }

  async function onStatus(status: TicketStatus) {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      const res = await ticketsApi.updateStatus(id, status);
      setTicket(res.ticket);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao atualizar status.');
    } finally {
      setBusy(false);
    }
  }

  if (!ticket && !error) {
    return <Text style={{ color: colors.muted }}>Carregando…</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Button title="← Tickets" variant="ghost" onPress={() => router.back()} />
      <Text style={styles.title}>{ticket?.title || 'Ticket'}</Text>
      <Text style={styles.sub}>
        {ticket?.account?.businessName} · {ticket?.account?.email}
        {'\n'}
        {STATUS_LABEL[ticket?.status || ''] || ticket?.status} ·{' '}
        {ticket?.createdByName} · {formatWhen(ticket?.createdAt || '')}
      </Text>
      <Text style={styles.body}>{ticket?.description}</Text>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Button
            key={s}
            title={STATUS_LABEL[s]}
            variant={ticket?.status === s ? 'primary' : 'ghost'}
            disabled={busy}
            onPress={() => onStatus(s)}
          />
        ))}
      </View>

      <Text style={styles.label}>Comentários</Text>
      {(ticket?.comments || []).length === 0 ? (
        <Text style={styles.empty}>Nenhum comentário ainda.</Text>
      ) : (
        ticket!.comments!.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Text style={styles.commentMeta}>
              {c.authorName}
              {c.authorRole === 'admin' ? ' · Sof' : ''} ·{' '}
              {formatWhen(c.createdAt)}
            </Text>
            <Text style={styles.commentBody}>{c.body}</Text>
          </View>
        ))
      )}

      <Field
        label="Responder"
        value={comment}
        onChangeText={setComment}
        multiline
        style={{ minHeight: 100, textAlignVertical: 'top' }}
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title="Enviar comentário"
        loading={busy}
        disabled={!comment.trim()}
        onPress={onComment}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 48, maxWidth: 720 },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
    marginTop: space.md,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginBottom: space.lg,
    marginTop: 4,
    lineHeight: 20,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.lg,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md },
  empty: { color: colors.muted, marginBottom: space.md },
  comment: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: space.md,
    marginBottom: space.sm,
  },
  commentMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  commentBody: {
    fontFamily: 'Inter_400Regular',
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
});
