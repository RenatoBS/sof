import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { d } from '@/src/theme/dashboard';

export function entityInitials(name: string, fallback = 'S') {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return fallback;
  return parts.map((w) => w[0]?.toUpperCase() || '').join('') || fallback;
}

/** Avatar com iniciais (e cor opcional da agenda). */
export function EntityAvatar({
  name,
  color,
  size = 44,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const bg = color || d.accent;
  const radius = Math.round(size * 0.28);
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
        },
      ]}
      accessibilityElementsHidden
    >
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.34) }]}>
        {entityInitials(name)}
      </Text>
    </View>
  );
}

export function EntityStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function EntityChip({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: 'neutral' | 'accent' | 'warn' | 'danger' | 'ok';
}) {
  return (
    <View style={[styles.chip, chipTone[tone]]}>
      <Text style={[styles.chipText, chipTextTone[tone]]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function EntityCardBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.body, style]}>{children}</View>;
}

export function EntityCardFooter({ children }: { children: React.ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

export const entityCardStyles = StyleSheet.create({
  page: { gap: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  entity: {
    minWidth: 260,
    flexGrow: 1,
    flexBasis: 280,
    maxWidth: '100%',
    padding: 0,
    overflow: 'hidden',
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  formHint: {
    color: d.muted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: d.fonts.body,
    marginBottom: 12,
  },
  formActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  count: {
    color: d.muted,
    fontSize: 13,
    fontFamily: d.fonts.body,
    marginTop: -8,
  },
});

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: d.fonts.displayBold,
    letterSpacing: 0.3,
  },
  body: {
    padding: 18,
    gap: 12,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: d.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: d.fill,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 100,
    minWidth: 88,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: d.fill,
    borderWidth: 1,
    borderColor: d.line,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: d.mutedStrong,
    fontFamily: d.fonts.bodyMedium,
  },
});

const chipTone = StyleSheet.create({
  neutral: {},
  accent: {
    backgroundColor: d.accentSoft,
    borderColor: d.line,
  },
  warn: {
    backgroundColor: d.copperSoft,
    borderColor: '#E5D5C3',
  },
  danger: {
    backgroundColor: d.dangerSoft,
    borderColor: '#F5C2C0',
  },
  ok: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
});

const chipTextTone = StyleSheet.create({
  neutral: {},
  accent: { color: d.accent },
  warn: { color: '#8F6E45' },
  danger: { color: d.danger },
  ok: { color: d.waGreenText },
});
