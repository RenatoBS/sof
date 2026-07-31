import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, type Href } from 'expo-router';
import {
  ErrorText,
  PageHeader,
  SearchField,
} from '@/src/components/ui';
import {
  fetchDocsManifest,
  type ClientGuide,
  type DocEntry,
  type DocsManifest,
} from '@/src/docs/catalog';
import { colors, fonts, radius, shadow, space } from '@/src/theme/admin';

function openExternal(href: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }
  void Linking.openURL(href);
}

export default function DocsHubScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
    >
      <PageHeader
        title="Documentação"
        subtitle="Tudo que vive em docs/ — atualizado com o projeto. Área interna Sof."
      />

      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder="Buscar por título, grupo ou resumo…"
      />

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}

      {!loading && !error
        ? byGroup.map(([group, docs]) => (
            <View key={group} style={styles.section}>
              <Text style={styles.groupTitle}>{group}</Text>
              <View style={[styles.grid, !wide && styles.gridNarrow]}>
                {docs.map((doc) => (
                  <DocCard key={doc.slug} doc={doc} />
                ))}
              </View>
            </View>
          ))
        : null}

      {!loading && !error && filtered.length === 0 ? (
        <Text style={styles.empty}>Nenhum documento com esse filtro.</Text>
      ) : null}

      {manifest?.clientGuides?.length ? (
        <View style={styles.section}>
          <Text style={styles.groupTitle}>Guias do cliente (públicos)</Text>
          <Text style={styles.groupHint}>
            Compartilháveis sem login — abrem em nova aba.
          </Text>
          <View style={[styles.grid, !wide && styles.gridNarrow]}>
            {manifest.clientGuides.map((g) => (
              <GuideCard key={g.href} guide={g} />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DocCard({ doc }: { doc: DocEntry }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={() => router.push(`/docs/${doc.slug}` as Href)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.card, hovered && styles.cardHover]}
    >
      <Text style={styles.cardKicker}>{doc.group}</Text>
      <Text style={styles.cardTitle}>{doc.title}</Text>
      <Text style={styles.cardSummary} numberOfLines={3}>
        {doc.summary}
      </Text>
    </Pressable>
  );
}

function GuideCard({ guide }: { guide: ClientGuide }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={() => openExternal(guide.href)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.card, styles.guideCard, hovered && styles.cardHover]}
    >
      <Text style={styles.cardKicker}>Público</Text>
      <Text style={styles.cardTitle}>{guide.title}</Text>
      <Text style={styles.cardSummary} numberOfLines={3}>
        {guide.summary}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    padding: space.lg,
    paddingBottom: space.xl * 2,
    gap: space.md,
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
  },
  section: { marginTop: space.md, gap: space.sm },
  groupTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  groupHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginBottom: space.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  gridNarrow: { flexDirection: 'column' },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    width: '100%',
    maxWidth: 320,
    flexGrow: 1,
    flexBasis: 260,
    ...shadow.soft,
  },
  guideCard: {
    backgroundColor: colors.copperSoft,
    borderColor: '#E6D9C7',
  },
  cardHover: {
    borderColor: colors.accent,
  },
  cardKicker: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: space.xs,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
    marginBottom: space.xs,
  },
  cardSummary: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.muted,
    marginTop: space.md,
  },
});
