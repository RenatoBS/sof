import { Link, router } from 'expo-router';
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
import { accountsApi, type AccountRow } from '@/src/api/endpoints';
import { Button } from '@/src/components/ui';
import { colors, space } from '@/src/theme/admin';

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
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Contas</Text>
          <Text style={styles.sub}>{total} no total</Text>
        </View>
        <Button title="Nova conta" onPress={() => router.push('/accounts-new')} />
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Buscar por e-mail, negócio ou responsável"
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
      ) : accounts.length === 0 ? (
        <Text style={styles.empty}>Nenhuma conta encontrada.</Text>
      ) : (
        accounts.map((item) => (
          <Link
            key={item.id}
            href={{ pathname: '/account-detail', params: { id: item.id } }}
            asChild
          >
            <Pressable style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.businessName}</Text>
                <Text style={styles.rowMeta}>
                  {item.email} · {item.ownerName}
                </Text>
              </View>
              <View style={styles.badges}>
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
              </View>
            </Pressable>
          </Link>
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
    gap: space.md,
    flexWrap: 'wrap',
  },
  title: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 28,
    color: colors.ink,
  },
  sub: { fontFamily: 'Inter_400Regular', color: colors.muted, marginTop: 4 },
  searchRow: {
    flexDirection: 'row',
    gap: space.sm,
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
  },
  error: { color: colors.danger, marginBottom: space.sm },
  empty: { color: colors.muted, marginTop: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
  badges: { alignItems: 'flex-end', gap: 4 },
  plan: { fontFamily: 'Inter_500Medium', color: colors.ink, fontSize: 13 },
  status: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  statusOff: { color: colors.warn },
});
