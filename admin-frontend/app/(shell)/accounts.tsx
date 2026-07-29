import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import { accountsApi, type AccountRow } from '@/src/api/endpoints';
import {
  Button,
  EmptyState,
  ErrorText,
  ListRow,
  PageHeader,
  SearchField,
} from '@/src/components/ui';
import { colors, fonts, space } from '@/src/theme/admin';

export default function AccountsScreen() {
  const [q, setQ] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (query?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await accountsApi.list({ q: query || undefined });
      setAccounts(res.accounts);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <PageHeader
        title="Contas"
        subtitle={`${total} no total`}
        action={
          <Button title="Nova conta" onPress={() => router.push('/new-account')} />
        }
      />

      <View style={styles.searchRow}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por e-mail, negócio ou responsável"
          onSubmitEditing={() => load(q)}
        />
        <Button title="Buscar" onPress={() => load(q)} variant="ghost" />
      </View>

      <ErrorText>{error}</ErrorText>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : accounts.length === 0 ? (
        <EmptyState message="Nenhuma conta encontrada." />
      ) : (
        accounts.map((item) => (
          <ListRow
            key={item.id}
            title={item.businessName}
            meta={`${item.email} · ${item.ownerName}`}
            onPress={() =>
              router.push({ pathname: '/edit-account', params: { id: item.id } })
            }
            right={
              <>
                <Text style={styles.plan}>
                  {item.plan} · R$ {item.planPrice}
                </Text>
                <Text
                  style={[
                    styles.status,
                    item.status === 'suspended' && styles.statusOff,
                  ]}
                >
                  {item.status}
                </Text>
              </>
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  searchRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.md,
    alignItems: 'center',
  },
  plan: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 13 },
  status: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  statusOff: { color: colors.warn },
});
