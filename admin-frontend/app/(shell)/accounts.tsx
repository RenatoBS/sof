import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError } from '@/src/api/client';
import {
  accountsApi,
  plansApi,
  type AccountRow,
} from '@/src/api/endpoints';
import {
  Button,
  EmptyState,
  ErrorText,
  ListRow,
  PageHeader,
  SearchField,
} from '@/src/components/ui';
import { colors, fonts, space } from '@/src/theme/admin';

function paramStr(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

export default function AccountsScreen() {
  const params = useLocalSearchParams<{ planId?: string; planName?: string }>();
  const planId = paramStr(params.planId);
  const planNameParam = paramStr(params.planName);

  const [q, setQ] = useState('');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [planLabel, setPlanLabel] = useState(planNameParam);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (query?: string) => {
      setLoading(true);
      setError('');
      try {
        const res = await accountsApi.list({
          q: query || undefined,
          planId: planId || undefined,
        });
        setAccounts(res.accounts);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Falha ao carregar.');
      } finally {
        setLoading(false);
      }
    },
    [planId],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!planId) {
      setPlanLabel('');
      return;
    }
    if (planNameParam) {
      setPlanLabel(planNameParam);
      return;
    }
    plansApi
      .list()
      .then((res) => {
        const found = res.plans.find((p) => p.id === planId);
        if (found) setPlanLabel(found.name);
      })
      .catch(() => undefined);
  }, [planId, planNameParam]);

  function clearPlanFilter() {
    router.replace('/accounts');
  }

  const subtitle = planLabel
    ? `${total} no plano ${planLabel}`
    : `${total} no total`;

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <PageHeader
        title="Contas"
        subtitle={subtitle}
        action={
          <Button title="Nova conta" onPress={() => router.push('/new-account')} />
        }
      />

      {planId ? (
        <View style={styles.filterRow}>
          <Text style={styles.filterChip}>
            Filtrando plano: {planLabel || planId}
          </Text>
          <Button title="Limpar filtro" variant="ghost" onPress={clearPlanFilter} />
        </View>
      ) : null}

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
            meta={`${item.email} · ${item.ownerName}${
              item.billingSource === 'promo' ? ' · promo' : ''
            }`}
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
                    item.status !== 'active' && styles.statusOff,
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
    flexWrap: 'wrap',
  },
  filterChip: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    fontSize: 14,
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
