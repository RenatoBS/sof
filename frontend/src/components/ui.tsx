import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { marketingColors } from '@/src/theme/marketing';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'accent';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        variant === 'ghost' && styles.ghost,
        variant === 'accent' && styles.accent,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'ghost' && styles.ghostText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Input({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={marketingColors.muted}
        autoCapitalize="none"
      />
    </View>
  );
}

export function LoadingGate({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={marketingColors.accent} />
      <Text style={styles.loadingText}>Carregando…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: marketingColors.ink,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  accent: { backgroundColor: marketingColors.accent },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: marketingColors.line,
  },
  disabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  ghostText: { color: marketingColors.ink },
  field: { gap: 6, marginBottom: 14 },
  label: { fontSize: 13, color: marketingColors.muted, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderColor: marketingColors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: marketingColors.ink,
    backgroundColor: '#fff',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: { color: marketingColors.muted },
});
