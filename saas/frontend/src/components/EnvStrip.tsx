import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { envStripCopy, resolveAppEnv } from '@/src/lib/appEnv';
import { m } from '@/src/theme/marketing';

/**
 * Faixa fina no topo (fora de produção) — landing, área logada e portal.
 * Texto alinhado à direita para marcar o canto superior direito.
 */
export function EnvStrip() {
  const copy = useMemo(() => envStripCopy(resolveAppEnv()), []);
  if (!copy) return null;

  const isQa = copy.detail === 'QA';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${copy.label}. ${copy.detail}`}
      style={[styles.strip, isQa ? styles.stripQa : styles.stripLocal]}
    >
      <Text style={[styles.text, isQa ? styles.textQa : styles.textLocal]}>
        {copy.label}
        <Text style={styles.sep}> · </Text>
        {copy.detail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    width: '100%',
    minHeight: 28,
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  },
  stripQa: {
    backgroundColor: m.copper,
  },
  stripLocal: {
    backgroundColor: m.ink,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: m.fonts.bodyMedium,
    letterSpacing: 0.2,
    textAlign: 'right',
  },
  textQa: {
    color: m.ink,
  },
  textLocal: {
    color: '#F4F4F6',
  },
  sep: {
    opacity: 0.7,
  },
});
