import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, type Href } from 'expo-router';
import {
  EmptyState,
  ErrorText,
  ListRow,
  PageHeader,
  SearchField,
} from '@/src/components/ui';
import {
  fetchDocsManifest,
  type ClientGuide,
  type DocEntry,
  type DocsManifest,
} from '@/src/docs/catalog';
import { colors, fonts, space } from '@/src/theme/admin';

function openExternal(href: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(href);
}

export default function DocsHubScreen() {
  const [manifest, setManifest] = useState<DocsManifest | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setManifest(await fetchDocsManifest());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar docs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!manifest) return [] as DocEntry[];
    const needle = q.trim().toLowerCase();
    if (!needle) return manifest.docs;
    return manifest.docs.filter((d) => {
      const hay = `${d.title} ${d.summary} ${d.group} ${d.slug}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [manifest, q]);

  const byGroup = useMemo(() => {
    const groups = manifest?.groups || [];
    const map = new Map<string, DocEntry[]>();
    for (const g of groups) map.set(g, []);
    for (const doc of filtered) {
      const list = map.get(doc.group) || [];
      list.push(doc);
      map.set(doc.group, list);
    }
    return [...map.entries()].filter(([, list]) => list.length > 0);
  }, [filtered, manifest]);

  const guides = useMemo(() => {
    const list = manifest?.clientGuides || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((g) => {
      const hay = `${g.title} ${g.summary}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [manifest, q]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <PageHeader
        title="Documentação"
        subtitle="Referência interna — a mesma pasta docs/ do repositório."
      />

      <View style={styles.searchRow}>
        <SearchField
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por título, grupo ou resumo…"
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
      ) : null}
      <ErrorText>{error}</ErrorText>

      {!loading && !error
        ? byGroup.map(([group, docs]) => (
            <View key={group} style={styles.section}>
              <Text style={styles.groupTitle}>{group}</Text>
              {docs.map((doc) => (
                <DocRow key={doc.slug} doc={doc} />
              ))}
            </View>
          ))
        : null}

      {!loading && !error && filtered.length === 0 && guides.length === 0 ? (
        <EmptyState message="Nenhum documento com esse filtro." />
      ) : null}

      {!loading && !error && guides.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.groupTitle}>Guias do cliente</Text>
          <Text style={styles.groupHint}>
            Públicos — abrem em nova aba, sem login.
          </Text>
          {guides.map((g) => (
            <GuideRow key={g.href} guide={g} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function DocRow({ doc }: { doc: DocEntry }) {
  return (
    <ListRow
      title={doc.title}
      meta={doc.summary}
      onPress={() => router.push(`/docs/${doc.slug}` as Href)}
      right={<Text style={styles.chevron}>Abrir</Text>}
    />
  );
}

function GuideRow({ guide }: { guide: ClientGuide }) {
  return (
    <ListRow
      title={guide.title}
      meta={guide.summary}
      onPress={() => openExternal(guide.href)}
      right={<Text style={styles.external}>↗</Text>}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40 },
  searchRow: {
    flexDirection: 'row',
    marginBottom: space.md,
  },
  section: { marginTop: space.lg },
  groupTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.sm,
  },
  groupHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.sm,
    marginTop: -4,
  },
  chevron: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.copper,
  },
  external: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.muted,
    lineHeight: 20,
  },
});
