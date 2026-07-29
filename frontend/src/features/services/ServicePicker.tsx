import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Service } from '@/src/api/types';
import { formatCurrency } from '@/src/context/DashboardContext';
import { SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export function ServicePicker({
  services,
  serviceId,
  onSelect,
}: {
  services: Service[];
  serviceId: string;
  onSelect: (serviceId: string) => void;
}) {
  const selected = services.find((s) => s.id === serviceId);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (selected) setQuery('');
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, query]);

  if (selected && !query) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Serviço</Text>
        <View style={styles.selected}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>{selected.name}</Text>
            <Text style={styles.selectedMeta}>
              {selected.duration} min — {formatCurrency(selected.price)}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              onSelect('');
              setQuery('');
            }}
          >
            <Text style={styles.change}>Trocar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Serviço</Text>
      <SofInput
        label="Buscar serviço"
        value={query}
        onChangeText={setQuery}
        theme="dashboard"
        placeholder="Ex.: Corte, Barba…"
        autoCapitalize="none"
      />
      <View style={styles.box}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {services.length === 0 ? (
            <Text style={styles.hint}>Nenhum serviço cadastrado.</Text>
          ) : filtered.length === 0 ? (
            <Text style={styles.hint}>Nenhum serviço encontrado.</Text>
          ) : (
            filtered.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  onSelect(s.id);
                  setQuery('');
                }}
                style={[
                  styles.result,
                  serviceId === s.id && styles.resultActive,
                ]}
              >
                <Text style={styles.resultName}>{s.name}</Text>
                <Text style={styles.resultMeta}>
                  {s.duration} min — {formatCurrency(s.price)}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 4 },
  label: { fontWeight: '600', color: '#334155', marginBottom: 2 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: d.accent,
    backgroundColor: d.accentSoft,
    borderRadius: d.radiusSm,
    padding: 12,
  },
  selectedName: { fontWeight: '700', color: d.ink, fontSize: 15 },
  selectedMeta: { color: d.muted, fontSize: 13, marginTop: 2 },
  change: { color: d.accent, fontWeight: '600' },
  box: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    backgroundColor: '#f8fafc',
    overflow: 'hidden',
    height: 160,
  },
  scroll: { flex: 1 },
  scrollInner: { padding: 8, gap: 6 },
  result: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    padding: 10,
    backgroundColor: '#fff',
  },
  resultActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  resultName: { fontWeight: '600', color: d.ink },
  resultMeta: { color: d.muted, fontSize: 12, marginTop: 2 },
  hint: { color: d.muted, fontSize: 13, padding: 4 },
});
