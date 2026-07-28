import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  featureCatalogApi,
  type EntitlementsMap,
  type FeatureCatalogItem,
} from '@/src/api/endpoints';
import { colors, space } from '@/src/theme/admin';

type Props = {
  value: EntitlementsMap;
  onChange: (next: EntitlementsMap) => void;
};

export function EntitlementsEditor({ value, onChange }: Props) {
  const [catalog, setCatalog] = useState<FeatureCatalogItem[]>([]);

  useEffect(() => {
    featureCatalogApi
      .list()
      .then((r) => setCatalog(r.features))
      .catch(() => undefined);
  }, []);

  function setKey(key: string, next: boolean | number | null) {
    onChange({ ...value, [key]: next });
  }

  if (!catalog.length) {
    return (
      <Text style={styles.hint}>Carregando catálogo de features…</Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Entitlements (gate por plano)</Text>
      <Text style={styles.hint}>
        Controle o que cada plano libera. Keys com aviso “stub” ainda não estão
        totalmente implementadas no produto.
      </Text>
      {catalog.map((f) => {
        const current = value[f.key];
        const isUnlimited =
          f.type === 'limit' && (current === null || current === undefined);
        return (
          <View key={f.key} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.label}>{f.label}</Text>
              {f.status === 'stub' ? (
                <Text style={styles.stub}>stub</Text>
              ) : null}
            </View>
            <Text style={styles.desc}>{f.description}</Text>
            {f.type === 'boolean' ? (
              <Switch
                value={Boolean(current)}
                onValueChange={(v) => setKey(f.key, v)}
                trackColor={{ true: colors.accent, false: colors.line }}
              />
            ) : (
              <View style={styles.limitRow}>
                <Pressable
                  onPress={() =>
                    setKey(f.key, isUnlimited ? (typeof f.defaultValue === 'number' ? f.defaultValue : 1) : null)
                  }
                  style={[styles.chip, isUnlimited && styles.chipOn]}
                >
                  <Text style={[styles.chipText, isUnlimited && styles.chipTextOn]}>
                    Ilimitado
                  </Text>
                </Pressable>
                {!isUnlimited ? (
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={String(typeof current === 'number' ? current : 0)}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/\D/g, ''), 10);
                      setKey(f.key, Number.isFinite(n) ? n : 0);
                    }}
                  />
                ) : null}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.lg, marginBottom: space.lg, gap: space.md },
  sectionTitle: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 18,
    color: colors.ink,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 13,
    marginBottom: space.sm,
  },
  row: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: space.md,
    gap: 6,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    fontFamily: 'Inter_600SemiBold',
    color: colors.ink,
    fontSize: 14,
  },
  stub: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  desc: {
    fontFamily: 'Inter_400Regular',
    color: colors.muted,
    fontSize: 12,
  },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: 'Inter_600SemiBold', color: colors.ink, fontSize: 12 },
  chipTextOn: { color: '#fff' },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    fontFamily: 'Inter_400Regular',
    color: colors.ink,
  },
});
