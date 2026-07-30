import type { ReactNode } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { d } from '@/src/theme/dashboard';

/**
 * Shell de formulário no mesmo padrão do AppointmentModal
 * (overlay, card, título, scroll, ações).
 */
export function EntityFormModal({
  visible,
  title,
  children,
  actions,
  hint,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  hint?: string;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          <View style={styles.actions}>{actions}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: d.radius,
    padding: 32,
    width: '100%',
    maxWidth: 500,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    color: d.ink,
    fontFamily: d.fonts.displayBold,
  },
  hint: {
    color: d.muted,
    fontSize: 14,
    fontFamily: d.fonts.body,
    marginBottom: 4,
  },
  scroll: { maxHeight: 520 },
  actions: { gap: 10, marginTop: 8 },
});
