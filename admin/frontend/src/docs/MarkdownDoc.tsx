import { useMemo, useRef, type ReactNode } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { router, type Href } from 'expo-router';
import { colors, fonts, radius, space } from '@/src/theme/admin';
import { docBody, extractHeadings } from './catalog';

type Props = {
  markdown: string;
};

type MdNode = {
  key: string;
  type?: string;
  content?: string;
  attributes?: Record<string, unknown>;
  children?: MdNode[];
  sourceInfo?: string;
};

export function MarkdownDoc({ markdown }: Props) {
  const body = useMemo(() => docBody(markdown), [markdown]);
  const headings = useMemo(() => extractHeadings(body), [body]);

  /**
   * Os headings recebem o id pela ordem em que aparecem, então o cursor precisa
   * voltar a zero a cada render — senão o segundo render desloca todos os âncoras.
   */
  const cursor = useRef(0);
  cursor.current = 0;

  const rules = useMemo(() => {
    const uniqueId = () => headings[cursor.current++]?.id;
    return {
      heading1: (
        node: MdNode,
        children: ReactNode[],
        _parent: MdNode[],
        styles: typeof markdownStyles,
      ) => (
        <Text key={node.key} nativeID={uniqueId()} style={styles.heading1}>
          {children}
        </Text>
      ),
      heading2: (
        node: MdNode,
        children: ReactNode[],
        _parent: MdNode[],
        styles: typeof markdownStyles,
      ) => (
        <Text key={node.key} nativeID={uniqueId()} style={styles.heading2}>
          {children}
        </Text>
      ),
      heading3: (
        node: MdNode,
        children: ReactNode[],
        _parent: MdNode[],
        styles: typeof markdownStyles,
      ) => (
        <Text key={node.key} nativeID={uniqueId()} style={styles.heading3}>
          {children}
        </Text>
      ),
      table: (
        node: MdNode,
        children: ReactNode[],
        _parent: MdNode[],
        styles: typeof markdownStyles,
      ) => (
        <ScrollView
          key={node.key}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
          style={styles.tableScroll}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View style={styles.table}>{children}</View>
        </ScrollView>
      ),
    };
  }, [headings]);

  return (
    <View style={styles.wrap}>
      <Markdown
        style={markdownStyles}
        rules={rules}
        onLinkPress={(url) => {
          if (!url) return false;
          if (url.startsWith('/docs/')) {
            const path = url.replace(/^\/docs\//, '').split('#')[0];
            router.push(`/docs/${path}` as Href);
            return false;
          }
          if (url.startsWith('/guides/')) {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.open(url, '_blank', 'noopener,noreferrer');
            } else {
              void Linking.openURL(url);
            }
            return false;
          }
          if (url.startsWith('http://') || url.startsWith('https://')) {
            void Linking.openURL(url);
            return false;
          }
          return true;
        }}
      >
        {body}
      </Markdown>
    </View>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 24,
  },
  heading1: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    marginTop: space.md,
    marginBottom: space.md,
  },
  heading2: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 24,
    color: colors.ink,
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingBottom: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  heading3: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: space.md,
  },
  link: {
    color: colors.copper,
    textDecorationLine: 'underline',
  },
  strong: {
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
  },
  em: {
    fontStyle: 'italic',
  },
  bullet_list: {
    marginBottom: space.md,
  },
  ordered_list: {
    marginBottom: space.md,
  },
  list_item: {
    marginBottom: space.xs,
  },
  bullet_list_icon: {
    color: colors.muted,
    marginLeft: 0,
    marginRight: space.sm,
  },
  ordered_list_icon: {
    color: colors.muted,
    marginLeft: 0,
    marginRight: space.sm,
  },
  code_inline: {
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      default: 'Menlo',
    }),
    backgroundColor: colors.fill,
    color: colors.ink,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 13,
  },
  fence: {
    backgroundColor: colors.fill,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.md,
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      default: 'Menlo',
    }),
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
  },
  code_block: {
    backgroundColor: colors.fill,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.md,
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      default: 'Menlo',
    }),
    fontSize: 12,
    lineHeight: 18,
  },
  tableScroll: {
    marginBottom: space.md,
  },
  tableScrollContent: {
    flexGrow: 1,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    overflow: 'hidden',
    minWidth: '100%',
  },
  thead: {
    backgroundColor: colors.fill,
  },
  th: {
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.ink,
    minWidth: 120,
  },
  td: {
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    minWidth: 120,
  },
  tr: {
    borderBottomWidth: 0,
    flexDirection: 'row',
  },
  blockquote: {
    backgroundColor: colors.copperSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.copper,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.md,
  },
  hr: {
    backgroundColor: colors.line,
    height: StyleSheet.hairlineWidth,
    marginVertical: space.lg,
  },
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
});
