import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, fonts, radius, shadow, space } from '@/src/theme/admin';

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.btn,
        size === 'sm' && styles.btnSm,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        !isDisabled && (hovered || pressed) && styles.btnActive,
        isDisabled && styles.btnDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? colors.accent : '#fff'}
        />
      ) : (
        <Text
          style={[
            styles.btnText,
            size === 'sm' && styles.btnTextSm,
            variant === 'ghost' && { color: colors.ink },
            variant === 'danger' && { color: '#fff' },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.pageHeaderText}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.pageHeaderAction}>{action}</View> : null}
    </View>
  );
}

export function ListRow({
  title,
  meta,
  right,
  onPress,
}: {
  title: string;
  meta?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[styles.listRow, hovered && styles.listRowHovered]}
    >
      <View style={styles.listRowMain}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.listRowMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.listRowRight}>{right}</View> : null}
    </Pressable>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <Text style={styles.errorText}>{children}</Text>;
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      onSubmitEditing={onSubmitEditing}
      returnKeyType="search"
      style={styles.searchField}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs, marginBottom: space.md },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 16,
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.danger,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSm: {
    paddingVertical: 8,
    paddingHorizontal: space.md,
    borderRadius: radius.sm - 2,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnActive: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontFamily: fonts.displayBold,
    color: '#fff',
    fontSize: 15,
  },
  btnTextSm: { fontSize: 13 },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.md,
    flexWrap: 'wrap',
    marginBottom: space.lg,
  },
  pageHeaderText: { gap: 4, flexShrink: 1 },
  pageHeaderAction: { flexDirection: 'row', gap: space.sm },
  pageTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    color: colors.ink,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
    maxWidth: 480,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    ...shadow.soft,
  },
  listRowHovered: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  listRowMain: { flex: 1, gap: 2 },
  listRowTitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.ink,
  },
  listRowMeta: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 13,
  },
  listRowRight: { alignItems: 'flex-end', gap: 4 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    marginTop: space.md,
  },
  emptyStateText: {
    fontFamily: fonts.body,
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    color: colors.danger,
    fontSize: 13,
    marginBottom: space.sm,
  },
  searchField: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
});
