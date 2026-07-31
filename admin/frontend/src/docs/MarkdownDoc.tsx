import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { router, type Href } from 'expo-router';
import { colors, fonts, radius, space } from '@/src/theme/admin';
import { rewriteDocLinks } from './catalog';

type Props = {
  markdown: string;
};

export function MarkdownDoc({ markdown }: Props) {
  const body = useMemo(() => rewriteDocLinks(markdown), [markdown]);

  return (
    <View style={styles.wrap}>
      <Markdown
        style={markdownStyles}
        onLinkPress={(url) => {
          if (!url) return false;
          if (url.startsWith('/docs/')) {
            const path = url.replace(/^\/docs\//, '').split('#')[0];
            router.push(`/docs/${path}` as Href);
            return false;
          }
          if (url.startsWith('/guides/')) {
            if (typeof window !== 'undefined') {
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
    fontSize: 28,
    lineHeight: 34,
    color: colors.ink,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  heading2: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 26,
    color: colors.ink,
    marginTop: space.lg,
    marginBottom: space.sm,
    paddingBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  heading3: {
    fontFamily: fonts.display,
    fontSize: 17,
    lineHeight: 22,
    color: colors.ink,
    marginTop: space.md,
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
  code_inline: {
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
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
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
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
    fontFamily: 'Menlo, Monaco, Consolas, monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    marginBottom: space.md,
  },
  thead: {
    backgroundColor: colors.fill,
  },
  th: {
    padding: space.sm,
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
  },
  td: {
    padding: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    color: colors.ink,
  },
  tr: {
    borderBottomWidth: 0,
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
    height: 1,
    marginVertical: space.lg,
  },
});

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
});
