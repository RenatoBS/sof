import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { m } from '@/src/theme/marketing';
import { d } from '@/src/theme/dashboard';

type BtnVariant = 'solid' | 'accent' | 'ghost' | 'light' | 'dark' | 'danger';

export function SoftButton({
  title,
  onPress,
  variant = 'solid',
  large,
  block,
  disabled,
  theme = 'marketing',
}: {
  title: string;
  onPress: () => void;
  variant?: BtnVariant;
  large?: boolean;
  block?: boolean;
  disabled?: boolean;
  theme?: 'marketing' | 'dashboard';
}) {
  const isDash = theme === 'dashboard';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        isDash ? dashBtn.base : mktBtn.base,
        large && mktBtn.lg,
        block && { width: '100%' },
        variant === 'solid' && (isDash ? dashBtn.dark : mktBtn.solid),
        variant === 'accent' && mktBtn.accent,
        variant === 'ghost' && mktBtn.ghost,
        variant === 'light' && dashBtn.light,
        variant === 'dark' && dashBtn.dark,
        variant === 'danger' && dashBtn.danger,
        disabled && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          isDash ? dashBtn.text : mktBtn.text,
          (variant === 'ghost' || variant === 'light') && {
            color: isDash ? '#475569' : m.ink,
          },
          variant === 'danger' && { color: d.danger },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function SoftInput({
  label,
  theme = 'marketing',
  ...props
}: { label: string; theme?: 'marketing' | 'dashboard' } & TextInputProps) {
  const isDash = theme === 'dashboard';
  return (
    <View style={field.wrap}>
      <Text style={[field.label, isDash && field.labelDash]}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={isDash ? '#94a3b8' : m.muted}
        style={[field.input, isDash && field.inputDash, props.style]}
        autoCapitalize={props.autoCapitalize ?? 'none'}
      />
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return <Text style={field.eyebrow}>{children}</Text>;
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return <View style={field.wrapMax}>{children}</View>;
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
  },
  dark: { backgroundColor: d.ink },
  light: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: d.line,
  },
  danger: { backgroundColor: d.dangerSoft },
  text: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

const field = StyleSheet.create({
  wrap: { marginBottom: 18, gap: 8 },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: m.muted,
    fontFamily: m.fonts.bodyMedium,
  },
  labelDash: { fontSize: 14, fontWeight: '600', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: m.line,
    borderRadius: m.radiusSm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: m.ink,
    backgroundColor: m.surface,
    fontFamily: m.fonts.body,
  },
  inputDash: {
    borderColor: '#cbd5e1',
    borderRadius: d.radiusSm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  eyebrow: {
    fontFamily: m.fonts.display,
    fontSize: 12.5,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: m.accentInk,
    fontWeight: '600',
  },
  wrapMax: {
    width: '100%',
    maxWidth: m.wrap,
    alignSelf: 'center',
    paddingHorizontal: 28,
  },
});
