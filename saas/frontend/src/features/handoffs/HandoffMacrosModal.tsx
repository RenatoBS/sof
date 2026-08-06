import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { dashboardApi } from '@/src/api/endpoints';
import type { HandoffMacro } from '@/src/api/types';
import {
  SofButton,
  SofErrorBanner,
  SofInput,
} from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import { d } from '@/src/theme/dashboard';

type Props = {
  visible: boolean;
  onClose: () => void;
  onChanged: (macros: HandoffMacro[]) => void;
};

export function HandoffMacrosModal({ visible, onClose, onChanged }: Props) {
  const [macros, setMacros] = useState<HandoffMacro[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showForm, setShowForm] = useState(false);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await dashboardApi.handoffMacros();
      setMacros(res.macros);
      onChangedRef.current(res.macros);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar macros.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setEditingId(null);
    setTitle('');
    setBody('');
    setShowForm(false);
    setError('');
    void load();
  }, [visible, load]);

  const startCreate = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setShowForm(true);
    setError('');
  };

  const startEdit = (macro: HandoffMacro) => {
    setEditingId(macro.id);
    setTitle(macro.title);
    setBody(macro.body);
    setShowForm(true);
    setError('');
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setBody('');
  };

  const save = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setError('Informe título e texto da macro.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await dashboardApi.updateHandoffMacro(editingId, {
          title: t,
          body: b,
        });
      } else {
        await dashboardApi.createHandoffMacro({ title: t, body: b });
      }
      cancelForm();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível salvar a macro.',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (macro: HandoffMacro) => {
    setError('');
    try {
      await dashboardApi.updateHandoffMacro(macro.id, {
        active: !macro.active,
      });
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar a macro.',
      );
    }
  };

  const remove = async (macro: HandoffMacro) => {
    setError('');
    try {
      await dashboardApi.deleteHandoffMacro(macro.id);
      if (editingId === macro.id) cancelForm();
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível excluir a macro.',
      );
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title="Macros de atendimento"
      hint="Textos prontos para a equipe inserir no chat. Só macros ativas aparecem no composer."
      actions={
        <>
          {showForm ? (
            <>
              <SofButton
                title={editingId ? 'Salvar macro' : 'Criar macro'}
                variant="dark"
                theme="dashboard"
                loading={saving}
                disabled={saving}
                onPress={() => void save()}
              />
              <SofButton
                title="Cancelar edição"
                variant="light"
                theme="dashboard"
                disabled={saving}
                onPress={cancelForm}
              />
            </>
          ) : (
            <SofButton
              title="Nova macro"
              variant="dark"
              theme="dashboard"
              disabled={loading}
              onPress={startCreate}
            />
          )}
          <SofButton
            title="Fechar"
            variant="light"
            theme="dashboard"
            disabled={saving}
            onPress={onClose}
          />
        </>
      }
    >
      {error ? <SofErrorBanner message={error} /> : null}

      {showForm ? (
        <View style={styles.form}>
          <SofInput
            label="Título"
            theme="dashboard"
            value={title}
            onChangeText={setTitle}
            maxLength={60}
            placeholder="Ex.: Saudação"
          />
          <Text style={styles.label}>Texto</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={4000}
            placeholder="Mensagem que será inserida no composer…"
            placeholderTextColor={d.muted}
            style={styles.bodyInput}
          />
        </View>
      ) : null}

      {loading ? (
        <Text style={styles.muted}>Carregando…</Text>
      ) : macros.length === 0 ? (
        <Text style={styles.muted}>Nenhuma macro ainda. Crie a primeira.</Text>
      ) : (
        <ScrollView style={styles.list}>
          {macros.map((macro) => (
            <View
              key={macro.id}
              style={[styles.row, !macro.active && styles.rowInactive]}
            >
              <Pressable style={styles.rowMain} onPress={() => startEdit(macro)}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {macro.title}
                  {!macro.active ? ' · inativa' : ''}
                </Text>
                <Text style={styles.rowBody} numberOfLines={2}>
                  {macro.body}
                </Text>
              </Pressable>
              <View style={styles.rowActions}>
                <Pressable onPress={() => void toggleActive(macro)}>
                  <Text style={styles.link}>
                    {macro.active ? 'Desativar' : 'Ativar'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void remove(macro)}>
                  <Text style={[styles.link, styles.linkDanger]}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </EntityFormModal>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10, marginBottom: 12 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  bodyInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    padding: 12,
    fontSize: 14,
    color: d.ink,
    fontFamily: d.fonts.body,
    textAlignVertical: 'top',
  },
  list: { maxHeight: 280 },
  row: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    padding: 12,
    marginBottom: 8,
    gap: 8,
    backgroundColor: d.surface,
  },
  rowInactive: { opacity: 0.65 },
  rowMain: { gap: 4 },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  rowBody: {
    fontSize: 13,
    color: d.muted,
    fontFamily: d.fonts.body,
    lineHeight: 18,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 16,
  },
  link: {
    fontSize: 13,
    fontWeight: '700',
    color: d.accent,
    fontFamily: d.fonts.bodyMedium,
  },
  linkDanger: { color: '#b91c1c' },
  muted: {
    color: d.muted,
    fontSize: 14,
    fontFamily: d.fonts.body,
    marginVertical: 8,
  },
});
