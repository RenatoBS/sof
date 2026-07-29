import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { m } from '@/src/theme/marketing';
import { d } from '@/src/theme/dashboard';

type BtnVariant = 'solid' | 'accent' | 'ghost' | 'light' | 'dark' | 'danger';

export function SofButton({
  title,
  onPress,
  variant = 'solid',
  large,
  block,
  disabled,
  loading,
  theme = 'marketing',
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  large?: boolean;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  theme?: 'marketing' | 'dashboard';
}) {
  const isDash = theme === 'dashboard';
  const isDisabled = disabled || loading;
  const labelColor =
    variant === 'ghost' || variant === 'light'
      ? isDash
        ? d.mutedStrong
        : m.ink
      : variant === 'danger'
        ? d.danger
        : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={(state) => {
        const pressed = state.pressed;
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        return [
          isDash ? dashBtn.base : mktBtn.base,
          large && mktBtn.lg,
          block && { width: '100%' as const },
          variant === 'solid' && (isDash ? dashBtn.dark : mktBtn.solid),
          variant === 'accent' && mktBtn.accent,
          variant === 'ghost' && mktBtn.ghost,
          variant === 'light' && dashBtn.light,
          variant === 'dark' && dashBtn.dark,
          variant === 'danger' && dashBtn.danger,
          isDisabled && { opacity: 0.55 },
          !isDisabled && pressed && { opacity: 0.88, transform: [{ scale: 0.985 }] },
          !isDisabled && hovered && !pressed && { opacity: 0.94 },
          Platform.OS === 'web'
            ? ({ cursor: isDisabled ? 'default' : 'pointer' } as object)
            : null,
        ];
      }}
    >
      {loading ? (
        <View style={mktBtn.row}>
          <ActivityIndicator color={labelColor} size="small" />
          <Text
            style={[
              isDash ? dashBtn.text : mktBtn.text,
              { color: labelColor },
            ]}
          >
            {title}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            isDash ? dashBtn.text : mktBtn.text,
            { color: labelColor },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function SofInput({
  label,
  theme = 'marketing',
  error,
  ...props
}: {
  label: string;
  theme?: 'marketing' | 'dashboard';
  error?: string;
} & TextInputProps) {
  const isDash = theme === 'dashboard';
  return (
    <View style={field.wrap}>
      <Text style={[field.label, isDash && field.labelDash]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={isDash ? d.muted : m.muted}
        style={[
          field.input,
          isDash && field.inputDash,
          error ? field.inputError : null,
          props.style,
        ]}
        autoCapitalize={props.autoCapitalize ?? 'none'}
        accessibilityState={{
          ...(typeof props.accessibilityState === 'object'
            ? props.accessibilityState
            : null),
          disabled: Boolean(props.editable === false),
        }}
        accessibilityHint={error || props.accessibilityHint}
      />
      {error ? <Text style={field.errorText}>{error}</Text> : null}
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={field.eyebrow}>{children}</Text>;
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={field.wrapMax}>{children}</View>;
}

export function SofCard({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[card.base, padded && card.padded, style]}>{children}</View>
  );
}

export function SofPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={pageHead.row}>
      <View style={pageHead.copy}>
        <Text style={pageHead.title}>{title}</Text>
        {subtitle ? <Text style={pageHead.sub}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={pageHead.action}>{action}</View> : null}
    </View>
  );
}

export function SofEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={empty.wrap}>
      <Text style={empty.title}>{title}</Text>
      {body ? <Text style={empty.body}>{body}</Text> : null}
      {action ? <View style={empty.action}>{action}</View> : null}
    </View>
  );
}

export function SofErrorBanner({ message }: { message: string }) {
  return (
    <View style={alert.error} accessibilityRole="alert">
      <Text style={alert.errorText}>{message}</Text>
    </View>
  );
}

export function SofAuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[auth.card, m.shadow.soft]}>
      <Text style={auth.title}>{title}</Text>
      {subtitle ? <Text style={auth.sub}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export function SofLoadingGate({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={gate.wrap}>
      <ActivityIndicator color={d.muted} />
      <Text style={gate.text}>{label}</Text>
    </View>
  );
}

export function SofListRow({
  title,
  meta,
  onPress,
  trailing,
}: {
  title: string;
  meta?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={listRow.copy}>
        <Text style={listRow.title}>{title}</Text>
        {meta ? <Text style={listRow.meta}>{meta}</Text> : null}
      </View>
      {trailing}
    </>
  );

  if (!onPress) {
    return <View style={listRow.base}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(state) => {
        const pressed = state.pressed;
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        return [
          listRow.base,
          listRow.pressable,
          pressed && { backgroundColor: d.fill },
          hovered && !pressed && { backgroundColor: d.accentSoft },
          Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
        ];
      }}
    >
      {content}
    </Pressable>
  );
}

const mktBtn = StyleSheet.create({
  base: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: { paddingVertical: 14, paddingHorizontal: 27 },
  solid: { backgroundColor: m.ink },
  accent: { backgroundColor: m.accent },
  ghost: { backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: {
    fontFamily: m.fonts.bodyMedium,
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
});

const dashBtn = StyleSheet.create({
  base: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: d.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { backgroundColor: d.ink },
  light: {
    backgroundColor: d.fill,
    borderWidth: 1,
    borderColor: d.line,
  },
  danger: { backgroundColor: d.dangerSoft },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    fontFamily: d.fonts.bodyMedium,
  },
});

const field = StyleSheet.create({
  wrap: { marginBottom: 18, gap: 8 },
  label: {
    fontSize: 13.5,
    fontWeight: '500',
    color: m.ink,
    fontFamily: m.fonts.bodyMedium,
    marginBottom: 7,
  },
  labelDash: {
    fontSize: 14,
    fontWeight: '600',
    color: d.mutedStrong,
    marginBottom: 8,
    fontFamily: d.fonts.bodyMedium,
  },
  input: {
    borderWidth: 1,
    borderColor: m.line,
    borderRadius: m.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: m.ink,
    backgroundColor: m.paper,
    fontFamily: m.fonts.body,
    ...(Platform.OS === 'web'
      ? ({ outlineStyle: 'none' } as object)
      : null),
  },
  inputDash: {
    borderColor: d.lineStrong,
    borderRadius: d.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    backgroundColor: d.surface,
    fontFamily: d.fonts.body,
  },
  inputError: {
    borderColor: d.danger,
  },
  errorText: {
    color: d.danger,
    fontSize: 13,
    fontWeight: '600',
    marginTop: -2,
    fontFamily: d.fonts.bodyMedium,
  },
  eyebrow: {
    fontFamily: m.fonts.display,
    fontSize: 12.5,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: m.copperInk,
    fontWeight: '600',
  },
  wrapMax: {
    width: '100%',
    maxWidth: m.wrap,
    alignSelf: 'center',
    paddingHorizontal: 28,
  },
});

const card = StyleSheet.create({
  base: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    ...d.shadow.soft,
  },
  padded: { padding: d.space.xl },
});

const pageHead = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: d.space.lg,
    flexWrap: 'wrap',
  },
  copy: { flex: 1, minWidth: 180, gap: 6 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 14,
    color: d.muted,
    fontFamily: d.fonts.body,
    lineHeight: 20,
  },
  action: { flexShrink: 0 },
});

const empty = StyleSheet.create({
  wrap: {
    paddingVertical: d.space.xxl,
    paddingHorizontal: d.space.lg,
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  body: {
    fontSize: 14,
    color: d.muted,
    fontFamily: d.fonts.body,
    lineHeight: 20,
    maxWidth: 420,
  },
  action: { marginTop: 12 },
});

const alert = StyleSheet.create({
  error: {
    backgroundColor: d.dangerSoft,
    borderRadius: d.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  errorText: {
    color: d.danger,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: d.fonts.bodyMedium,
  },
});

const auth = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: m.surface,
    borderRadius: m.radius,
    paddingVertical: 36,
    paddingHorizontal: 32,
    alignSelf: 'center',
  },
  title: {
    fontFamily: m.fonts.displayBold,
    fontSize: 28,
    color: m.ink,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sub: {
    fontFamily: m.fonts.body,
    fontSize: 15,
    color: m.muted,
    lineHeight: 22,
    marginBottom: 22,
  },
});

const gate = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: d.paper,
    padding: 32,
  },
  text: {
    color: d.muted,
    fontSize: 15,
    fontFamily: d.fonts.body,
  },
});

const listRow = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  pressable: { marginHorizontal: -8, paddingHorizontal: 8, borderRadius: d.radiusSm },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  meta: {
    fontSize: 13,
    color: d.muted,
    fontFamily: d.fonts.body,
  },
});
