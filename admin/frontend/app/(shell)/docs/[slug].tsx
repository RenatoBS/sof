import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Button, ErrorText, PageHeader } from '@/src/components/ui';
import {
  extractToc,
  fetchDocMarkdown,
  fetchDocsManifest,
  type DocEntry,
  type TocItem,
} from '@/src/docs/catalog';
import { MarkdownDoc } from '@/src/docs/MarkdownDoc';
import { colors, fonts, radius, space } from '@/src/theme/admin';

function paramStr(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

export default function DocViewerScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>();
  const slug = paramStr(slugParam);
  const { width } = useWindowDimensions();
  const showToc = width >= 960;

  const [markdown, setMarkdown] = useState('');
  const [meta, setMeta] = useState<DocEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!slug) {
      setError('Documento inválido.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [md, manifest] = await Promise.all([
        fetchDocMarkdown(slug),
        fetchDocsManifest().catch(() => null),
      ]);
      setMarkdown(md);
      setMeta(manifest?.docs.find((d) => d.slug === slug) || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao abrir documento.');
      setMarkdown('');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const toc = useMemo(() => extractToc(markdown), [markdown]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.mainContent}
      >
        <PageHeader
          title={meta?.title || slug || 'Documento'}
          subtitle={meta?.summary}
          action={
            <Button
              title="Todos os docs"
              variant="ghost"
              size="sm"
              onPress={() => router.push('/docs' as Href)}
            />
          }
        />

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}

        {!loading && !error && markdown ? (
          <View style={styles.article}>
            <MarkdownDoc markdown={markdown} />
          </View>
        ) : null}
      </ScrollView>

      {showToc && toc.length > 0 ? (
        <ScrollView
          style={styles.toc}
          contentContainerStyle={styles.tocContent}
        >
          <Text style={styles.tocTitle}>Nesta página</Text>
          {toc.map((item) => (
            <TocLink key={item.id} item={item} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function TocLink({ item }: { item: TocItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={() => {
        // react-native-markdown-display doesn't expose heading anchors on RN web
        // reliably; keep TOC as visual outline of sections.
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={styles.tocItem}
    >
      <Text
        style={[
          styles.tocText,
          item.level === 3 && styles.tocTextNested,
          hovered && styles.tocTextHover,
        ]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  main: { flex: 1 },
  mainContent: {
    padding: space.lg,
    paddingBottom: space.xl * 2,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
  },
  article: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  toc: {
    width: 240,
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    backgroundColor: colors.paper,
  },
  tocContent: {
    padding: space.md,
    gap: space.xs,
  },
  tocTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: space.sm,
  },
  tocItem: {
    paddingVertical: 4,
  },
  tocText: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
  },
  tocTextNested: {
    paddingLeft: space.sm,
    color: colors.muted,
    fontSize: 12,
  },
  tocTextHover: {
    color: colors.copper,
  },
});
