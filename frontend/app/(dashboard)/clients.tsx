import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

export default function ClientsScreen() {
  const { clients, setClients } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingId;

  const resetForm = () => {
    setName('');
    setPhone('');
    setError('');
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
  };

  const startCreate = () => {
    setName('');
    setPhone('');
    setError('');
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setName(client.name);
    setPhone(client.phone);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('Informe o nome do cliente.');
      return;
    }
    if (!phone.replace(/\D/g, '')) {
      setError('Informe o telefone do cliente.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.replace(/\D/g, ''),
      };
      if (editingId) {
        const { client } = await dashboardApi.updateClient(editingId, body);
        setClients((prev) =>
          prev
            .map((c) => (c.id === client.id ? client : c))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
      } else {
        const { client } = await dashboardApi.createClient(body);
        setClients((prev) =>
          [...prev, client].sort((a, b) =>
            a.name.localeCompare(b.name, 'pt-BR'),
          ),
        );
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteClient(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Clientes</Text>
          <Text style={styles.sub}>
            Cadastre nome e telefone para vincular aos agendamentos
          </Text>
        </View>
        <SofButton
          title={showForm ? 'Cancelar' : 'Adicionar Cliente'}
          variant="dark"
          theme="dashboard"
          onPress={() => {
            if (showForm) resetForm();
            else startCreate();
          }}
        />
      </View>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
          </Text>
          <View style={styles.formGrid}>
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
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <SofButton
              title={
                loading
                  ? 'Salvando…'
                  : isEditing
                    ? 'Salvar alterações'
                    : 'Adicionar'
              }
              variant="dark"
              theme="dashboard"
              onPress={save}
              disabled={loading}
            />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={resetForm}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        {clients.length === 0 ? (
          <Text style={styles.empty}>
            Nenhum cliente cadastrado ainda. Adicione manualmente ou aguarde o
            cadastro pelo WhatsApp.
          </Text>
        ) : (
          clients.map((c) => (
            <View key={c.id} style={styles.entity}>
              <Text style={styles.name}>{c.name}</Text>
              <Text style={styles.meta}>{formatPhone(c.phone)}</Text>
              <View style={styles.cardActions}>
                <Pressable onPress={() => startEdit(c)}>
                  <Text style={styles.edit}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => remove(c.id)}>
                  <Text style={styles.delete}>Remover</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  h2: { fontSize: 30, fontWeight: '700', color: d.ink },
  sub: { color: d.muted, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 24,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: d.ink },
  formGrid: { gap: 12 },
  error: { color: '#dc2626', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  empty: { color: d.muted, fontSize: 14 },
  entity: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 20,
    width: 280,
    gap: 8,
  },
  name: { fontSize: 17, fontWeight: '700', color: d.ink },
  meta: { color: d.muted, fontSize: 13 },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  edit: { color: d.accent, fontWeight: '600' },
  delete: { color: '#dc2626', fontWeight: '600' },
});
