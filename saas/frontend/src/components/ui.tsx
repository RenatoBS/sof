import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { m } from '@/src/theme/marketing';
import { d } from '@/src/theme/dashboard';
import { maskBrPhone, maskEmail, maskPhoneWithDdi } from '@/src/lib/validation';

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

/** Máscaras dos campos recorrentes; o valor exibido é formatado, o submit normaliza. */
export type InputMask = 'phone' | 'phoneDdi' | 'email';

const INPUT_MASKS: Record<
  InputMask,
  { format: (raw: string) => string; props: TextInputProps }
> = {
  phone: {
    format: maskBrPhone,
    props: {
      keyboardType: 'phone-pad',
      inputMode: 'tel',
      autoComplete: 'tel',
      textContentType: 'telephoneNumber',
      maxLength: 15,
    },
  },
  phoneDdi: {
    format: maskPhoneWithDdi,
    props: {
      keyboardType: 'phone-pad',
      inputMode: 'tel',
      autoComplete: 'tel',
      textContentType: 'telephoneNumber',
      maxLength: 20,
    },
  },
  email: {
    format: maskEmail,
    props: {
      keyboardType: 'email-address',
      inputMode: 'email',
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'email',
      textContentType: 'emailAddress',
    },
  },
};

export function SofInput({
  label,
  theme = 'marketing',
  error,
  mask,
  onChangeText,
  ...props
}: {
  label: string;
  theme?: 'marketing' | 'dashboard';
  error?: string;
  mask?: InputMask;
} & TextInputProps) {
  const isDash = theme === 'dashboard';
  const maskConfig = mask ? INPUT_MASKS[mask] : null;
  const handleChangeText = maskConfig
    ? (text: string) => onChangeText?.(maskConfig.format(text))
    : onChangeText;
  return (
    <View style={field.wrap}>
      <Text style={[field.label, isDash && field.labelDash]}>{label}</Text>
      <TextInput
        {...maskConfig?.props}
        {...props}
        onChangeText={handleChangeText}
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

const COMPACT_ACTION_BP = 720;

function ActionGlyph({
  name,
  color,
  size = 16,
}: {
  name: 'edit' | 'remove' | 'close';
  color: string;
  size?: number;
}) {
  const common = {
    stroke: color,
    fill: 'none' as const,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (name === 'edit') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <Path {...common} d="M12 20h9" />
        <Path {...common} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </Svg>
    );
  }
  if (name === 'close') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <Path {...common} d="M18 6L6 18M6 6l12 12" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path {...common} d="M3 6h18" />
      <Path {...common} d="M8 6V4h8v2" />
      <Path {...common} d="M19 6l-1 14H6L5 6" />
      <Path {...common} d="M10 11v6M14 11v6" />
    </Svg>
  );
}

/** Ação de linha (Editar / Remover / Fechar): ícone + texto; em viewport &lt; 720px só o ícone. */
export function SofIconAction({
  action,
  onPress,
  label,
  disabled,
  forceCompact,
}: {
  action: 'edit' | 'remove' | 'close';
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  /** Força só ícone (útil em cards estreitos). */
  forceCompact?: boolean;
}) {
  const { width } = useWindowDimensions();
  const compact = forceCompact ?? width < COMPACT_ACTION_BP;
  const resolvedLabel =
    label ??
    (action === 'edit' ? 'Editar' : action === 'remove' ? 'Remover' : 'Fechar');
  const color =
    action === 'edit' ? d.accent : action === 'remove' ? d.danger : d.muted;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
      hitSlop={8}
      style={(state) => {
        const pressed = state.pressed;
        const hovered = Boolean((state as { hovered?: boolean }).hovered);
        return [
          iconAction.base,
          compact && iconAction.compact,
          disabled && { opacity: 0.45 },
          !disabled && pressed && { opacity: 0.7 },
          !disabled && hovered && !pressed && { backgroundColor: d.fill },
          Platform.OS === 'web'
            ? ({ cursor: disabled ? 'default' : 'pointer' } as object)
            : null,
        ];
      }}
    >
      <ActionGlyph name={action} color={color} />
      {!compact ? (
        <Text style={[iconAction.label, { color }]}>{resolvedLabel}</Text>
      ) : null}
    </Pressable>
  );
}

/** Par Editar + Remover com o mesmo comportamento responsivo. */
export function SofRowActions({
  onEdit,
  onRemove,
  editLabel = 'Editar',
  removeLabel = 'Remover',
  disabled,
  style,
}: {
  onEdit?: () => void;
  onRemove?: () => void;
  editLabel?: string;
  removeLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[iconAction.row, style]}>
      {onEdit ? (
        <SofIconAction
          action="edit"
          label={editLabel}
          onPress={onEdit}
          disabled={disabled}
        />
      ) : null}
      {onRemove ? (
        <SofIconAction
          action="remove"
          label={removeLabel}
          onPress={onRemove}
          disabled={disabled}
        />
      ) : null}
    </View>
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
    gap: d.space.md,
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
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: d.line,
  },
  pressable: {
    borderRadius: d.radiusSm,
  },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
    lineHeight: 22,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    color: d.muted,
    fontFamily: d.fonts.body,
  },
});

const iconAction = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: d.radiusSm,
    minHeight: 36,
  },
  compact: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: d.fonts.bodyMedium,
  },
});
