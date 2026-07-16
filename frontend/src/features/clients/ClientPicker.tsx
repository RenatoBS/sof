import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/src/api/types';
import { formatPhone } from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function looksLikePhone(value: string) {
  const digits = digitsOnly(value);
  return digits.length >= 8 && /^\d[\d\s()-]*$/.test(value.trim());
}

export function ClientPicker({
  clients,
  clientId,
  onSelect,
  onCreateClient,
}: {
  clients: Client[];
  clientId: string;
  onSelect: (clientId: string) => void;
  onCreateClient: (body: {
    name: string;
    phone: string;
  }) => Promise<Client>;
}) {
  const selected = clients.find((c) => c.id === clientId);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digitsOnly(query);
    if (!q && !qDigits) return clients;
    return clients.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = qDigits
        ? digitsOnly(c.phone).includes(qDigits)
        : false;
      return nameMatch || phoneMatch;
    });
  }, [clients, query]);

  const openCreate = () => {
    setError('');
    if (looksLikePhone(query)) {
      setPhone(digitsOnly(query));
      setName('');
    } else {
      setName(query.trim());
      setPhone('');
    }
    setShowCreate(true);
  };

  const saveNew = async () => {
    setError('');
    if (!name.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    if (!digitsOnly(phone)) {
      setError('Informe o telefone do cliente.');
      return;
    }
    setLoading(true);
    try {
      const client = await onCreateClient({
        name: name.trim(),
        phone: digitsOnly(phone),
      });
      onSelect(client.id);
      setQuery('');
      setShowCreate(false);
      setName('');
      setPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  };

  if (selected && !showCreate && !query) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Cliente</Text>
        <View style={styles.selected}>
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedName}>{selected.name}</Text>
            <Text style={styles.selectedPhone}>
              {formatPhone(selected.phone)}
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
      <Text style={styles.label}>Cliente</Text>
      {showCreate ? (
        <View style={styles.createBox}>
          <SofInput
            label="Nome"
            value={name}
            onChangeText={setName}
            theme="dashboard"
            placeholder="Nome do cliente"
            autoCapitalize="words"
          />
          <SofInput
            label="Telefone"
            value={phone}
            onChangeText={setPhone}
            theme="dashboard"
            placeholder="11999990000"
            keyboardType="phone-pad"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <SofButton
              title={loading ? 'Salvando…' : 'Salvar cliente'}
              variant="dark"
              theme="dashboard"
              onPress={saveNew}
              disabled={loading}
            />
            <SofButton
              title="Voltar"
              variant="light"
              theme="dashboard"
              onPress={() => {
                setShowCreate(false);
                setError('');
              }}
            />
          </View>
        </View>
      ) : (
        <>
          <SofInput
            label="Buscar por nome ou telefone"
            value={query}
            onChangeText={setQuery}
            theme="dashboard"
            placeholder="Ex.: Maria ou 11999…"
            autoCapitalize="none"
          />
          <View style={styles.box}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollInner}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {filtered.length === 0 ? (
                <Text style={styles.hint}>Nenhum cliente encontrado.</Text>
              ) : (
                filtered.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      onSelect(c.id);
                      setQuery('');
                    }}
                    style={[
                      styles.result,
                      clientId === c.id && styles.resultActive,
                    ]}
                  >
                    <Text style={styles.resultName}>{c.name}</Text>
                    <Text style={styles.resultPhone}>
                      {formatPhone(c.phone)}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
          <Pressable onPress={openCreate} style={styles.addBtn}>
            <Text style={styles.addText}>+ Cadastrar cliente</Text>
          </Pressable>
        </>
      )}
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
    backgroundColor: '#eff6ff',
    borderRadius: d.radiusSm,
    padding: 12,
  },
  selectedName: { fontWeight: '700', color: d.ink, fontSize: 15 },
  selectedPhone: { color: d.muted, fontSize: 13, marginTop: 2 },
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
  resultActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  resultName: { fontWeight: '600', color: d.ink },
  resultPhone: { color: d.muted, fontSize: 12, marginTop: 2 },
  hint: { color: d.muted, fontSize: 13, padding: 4 },
  addBtn: { paddingVertical: 8 },
  addText: { color: d.accent, fontWeight: '700' },
  createBox: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  error: { color: d.danger, fontWeight: '600' },
});
