import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { ticketsApi, type TicketRow } from '@/src/api/endpoints';
import {
  Button,
  EmptyState,
  ErrorText,
  ListRow,
  PageHeader,
  SearchField,
} from '@/src/components/ui';
import { colors, fonts, space } from '@/src/theme/admin';

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
      <PageHeader title="Tickets" subtitle={`${total} no filtro atual`} />

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
            size="sm"
            variant={statusFilter === value ? 'primary' : 'ghost'}
            onPress={() => {
              setStatusFilter(value);
            }}
          />
        ))}
      </View>

      <View style={styles.searchRow}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Buscar título, descrição ou estabelecimento"
          onSubmitEditing={() => load(q)}
        />
        <Button title="Buscar" onPress={() => load(q)} variant="ghost" />
      </View>

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : tickets.length === 0 ? (
        <EmptyState message="Nenhum ticket encontrado." />
      ) : (
        tickets.map((item) => (
          <ListRow
            key={item.id}
            title={item.title}
            meta={`${item.account?.businessName || 'Conta'} · ${item.createdByName} · ${formatWhen(item.updatedAt)} · ${item.commentCount} comentário(s)`}
            onPress={() =>
              router.push({ pathname: '/edit-ticket', params: { id: item.id } })
            }
            right={
              <Text style={styles.status}>
                {STATUS_LABEL[item.status] || item.status}
              </Text>
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.md,
  },
  searchRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
    alignItems: 'center',
  },
  status: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.accent,
    textTransform: 'uppercase',
  },
});
