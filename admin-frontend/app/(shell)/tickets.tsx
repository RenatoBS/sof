import { router } from 'expo-router';
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
import { ticketsApi, type TicketRow } from '@/src/api/endpoints';
import { Button } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

const STATUS_LABEL: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

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

export default function TicketsScreen() {
  const [statusFilter, setStatusFilter] = useState('openish');
  const [q, setQ] = useState('');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (query?: string, status?: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await ticketsApi.list({
          q: query || undefined,
          status: status || statusFilter,
        });
        setTickets(res.tickets);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Falha ao carregar.');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Tickets</Text>
          <Text style={styles.sub}>{total} no filtro atual</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {(
          [
            ['openish', 'Abertos'],
            ['open', 'Aberto'],
            ['in_progress', 'Andamento'],
            ['resolved', 'Resolvido'],
            ['closed', 'Fechado'],
            ['all', 'Todos'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            title={label}
            variant={statusFilter === value ? 'primary' : 'ghost'}
            onPress={() => {
              setStatusFilter(value);
            }}
          />
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Buscar título, descrição ou estabelecimento"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          onSubmitEditing={() => load(q)}
        />
        <Button title="Buscar" onPress={() => load(q)} variant="ghost" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : tickets.length === 0 ? (
        <Text style={styles.empty}>Nenhum ticket encontrado.</Text>
      ) : (
        tickets.map((item) => (
          <Pressable
            key={item.id}
            style={styles.row}
            onPress={() =>
              router.push({ pathname: '/edit-ticket', params: { id: item.id } })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {item.account?.businessName || 'Conta'} · {item.createdByName} ·{' '}
                {formatWhen(item.updatedAt)} · {item.commentCount} comentário(s)
              </Text>
            </View>
            <Text style={styles.status}>
              {STATUS_LABEL[item.status] || item.status}
            </Text>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
  },
  sub: { fontFamily: 'Inter_400Regular', color: colors.muted, marginTop: 4 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: space.md,
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: space.md,
    alignItems: 'center',
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    backgroundColor: colors.paper,
    fontFamily: 'Inter_400Regular',
    color: colors.ink,
    marginRight: space.sm,
  },
  error: { color: colors.danger, marginBottom: space.sm },
  empty: { color: colors.muted, marginTop: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowTitle: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 16,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    marginTop: 2,
    fontSize: 13,
  },
  status: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.accent,
    textTransform: 'uppercase',
    marginLeft: space.md,
  },
});
