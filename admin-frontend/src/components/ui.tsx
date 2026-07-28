import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, space } from '@/src/theme/admin';

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
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'ghost' && { color: colors.ink },
          variant === 'danger' && { color: '#fff' },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs, marginBottom: space.md },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: colors.danger,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: space.lg,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnText: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    color: '#fff',
    fontSize: 15,
  },
});
