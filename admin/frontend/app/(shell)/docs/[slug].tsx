import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
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

const TOC_WIDTH = 248;

function paramStr(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || raw === 'undefined') return '';
  return raw;
}

function scrollToHeading(id: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

        {meta?.group ? (
          <Text style={styles.crumb}>
            Docs · {meta.group}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.lg }} />
        ) : null}
        <ErrorText>{error}</ErrorText>

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
      onPress={() => scrollToHeading(item.id)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.tocItem, item.level === 3 && styles.tocItemNested]}
      accessibilityRole="link"
      accessibilityLabel={item.title}
    >
      <Text
        style={[styles.tocText, hovered && styles.tocTextHover]}
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
    gap: space.xl,
  },
  main: { flex: 1, minWidth: 0 },
  mainContent: {
    paddingBottom: 48,
  },
  crumb: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
    marginTop: -space.md,
    marginBottom: space.md,
  },
  article: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  /** `ScrollView` do RN Web nasce com `flexGrow: 1` — sem zerar, a coluna come o conteúdo. */
  toc: {
    width: TOC_WIDTH,
    flexBasis: TOC_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: '100%',
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
  },
  tocContent: {
    paddingLeft: space.lg,
    paddingBottom: space.xl,
    gap: 2,
  },
  tocTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.muted,
    marginBottom: space.sm,
  },
  tocItem: {
    paddingVertical: 6,
    paddingRight: space.sm,
    borderRadius: radius.sm - 2,
  },
  tocItemNested: {
    paddingLeft: space.md,
  },
  tocText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  tocTextHover: {
    color: colors.ink,
  },
});
