import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Employee } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import { SofButton, SofInput } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

const EMPLOYEE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
] as const;

export default function EmployeesScreen() {
  const { employees, setEmployees, services } = useDashboard();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState<string>(EMPLOYEE_COLORS[0]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteEmployeeId, setInviteEmployeeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [waSent, setWaSent] = useState(false);

  const isEditing = !!editingId;

  const nextDefaultColor = () =>
    EMPLOYEE_COLORS[employees.length % EMPLOYEE_COLORS.length];

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setColor(nextDefaultColor());
    setServiceIds([]);
    setResetPassword(false);
    setError('');
    setEditingId(null);
    setShowForm(false);
    setLoading(false);
  };

  const startCreate = () => {
    if (services.length === 0) {
      router.push('/(dashboard)/services?create=1');
      return;
    }
    setName('');
    setEmail('');
    setPhone('');
    setColor(nextDefaultColor());
    setServiceIds([]);
    setResetPassword(false);
    setError('');
    setInviteLink('');
    setInviteExpiresAt('');
    setInviteEmployeeId(null);
    setCopied(false);
    setWaSent(false);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setName(employee.name);
    setEmail(employee.email || '');
    setPhone(employee.phone || '');
    setColor((employee.color || EMPLOYEE_COLORS[0]).toLowerCase());
    setServiceIds((employee.services || []).map((s) => s.id));
    setResetPassword(false);
    setError('');
    setInviteLink('');
    setInviteExpiresAt('');
    setInviteEmployeeId(null);
    setCopied(false);
    setWaSent(false);
    setShowForm(true);
  };

  const showInvite = (
    link: string,
    expiresAt?: string,
    employeeId?: string,
  ) => {
    setInviteLink(link);
    setInviteExpiresAt(expiresAt || '');
    setInviteEmployeeId(employeeId || null);
    setCopied(false);
    setWaSent(false);
    setShowForm(false);
    setEditingId(null);
  };

  const copyInvite = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar. Selecione o link manualmente.');
    }
  };

  const sendInviteWhatsapp = async (employeeId?: string | null) => {
    const id = employeeId || inviteEmployeeId;
    if (!id) {
      setError('Salve o profissional antes de enviar o link no WhatsApp.');
      return;
    }
    setInviteEmployeeId(id);
    setSendingWa(true);
    setError('');
    try {
      const res = await dashboardApi.sendEmployeePasswordLink(id);
      setInviteLink(res.resetLink);
      setInviteExpiresAt(res.expiresAt);
      setWaSent(true);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar no WhatsApp.');
    } finally {
      setSendingWa(false);
    }
  };

  const save = async () => {
    setError('');
    if (serviceIds.length === 0) {
      setError('Selecione ao menos um serviço.');
      return;
    }
    if (!email.trim()) {
      setError('Informe o e-mail de acesso do profissional.');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Informe um telefone válido com DDD.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phoneDigits,
        serviceIds,
        color,
      };
      if (editingId) {
        const { employee, resetLink, expiresAt } =
          await dashboardApi.updateEmployee(editingId, {
            ...body,
            resetPassword,
          });
        setEmployees((prev) =>
          prev.map((e) => (e.id === employee.id ? employee : e)),
        );
        if (resetLink) {
          showInvite(resetLink, expiresAt, editingId);
          return;
        }
      } else {
        const { employee, resetLink, expiresAt } =
          await dashboardApi.createEmployee(body);
        setEmployees((prev) => [...prev, employee]);
        showInvite(resetLink, expiresAt, employee.id);
        return;
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <View>
          <Text style={styles.h2}>Profissionais</Text>
          <Text style={styles.sub}>
            Gerencie a equipe e o acesso de cada profissional
          </Text>
        </View>
        <SofButton
          title={showForm ? 'Cancelar' : 'Adicionar Profissional'}
          variant="dark"
          theme="dashboard"
          onPress={() => {
            if (showForm) resetForm();
            else startCreate();
          }}
        />
      </View>

      {inviteLink ? (
        <View style={styles.passwordCard}>
          <Text style={styles.cardTitle}>Link de acesso gerado</Text>
          <Text style={styles.hint}>
            Envie pelo WhatsApp do estabelecimento (mensagem com instruções +
            botão &quot;Redefinir senha&quot;) ou copie o link. Uso único, expira
            em 2 horas — ao abrir, o profissional define a senha e já entra na
            agenda.
          </Text>
          {inviteExpiresAt ? (
            <Text style={styles.hint}>
              Válido até{' '}
              {new Date(inviteExpiresAt).toLocaleString('pt-BR')}
            </Text>
          ) : null}
          <Text selectable style={styles.tempPass}>
            {inviteLink}
          </Text>
          <View style={styles.actions}>
            <SofButton
              title={
                sendingWa
                  ? 'Enviando…'
                  : waSent
                    ? 'Enviado no WhatsApp'
                    : 'Enviar no WhatsApp'
              }
              variant="dark"
              theme="dashboard"
              disabled={sendingWa || waSent || !inviteEmployeeId}
              onPress={() => sendInviteWhatsapp()}
            />
            <SofButton
              title={copied ? 'Copiado!' : 'Copiar link'}
              variant="light"
              theme="dashboard"
              onPress={copyInvite}
            />
            <SofButton
              title="Fechar"
              variant="light"
              theme="dashboard"
              onPress={() => {
                setInviteLink('');
                setInviteExpiresAt('');
                setInviteEmployeeId(null);
                setCopied(false);
                setWaSent(false);
              }}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar Profissional' : 'Novo Profissional'}
          </Text>
          <View style={styles.formGrid}>
            <SofInput
              label="Nome"
              value={name}
              onChangeText={setName}
              theme="dashboard"
              placeholder="Nome completo"
              autoCapitalize="words"
            />
            <SofInput
              label="Telefone"
              value={phone}
              onChangeText={setPhone}
              theme="dashboard"
              placeholder="11999998888"
              keyboardType="phone-pad"
            />
            <SofInput
              label="E-mail de acesso"
              value={email}
              onChangeText={setEmail}
              theme="dashboard"
              placeholder="profissional@salao.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Cor na agenda</Text>
            <View style={styles.colorRow}>
              {EMPLOYEE_COLORS.map((c) => {
                const active = color === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Selecionar cor ${c}`}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: c },
                      active && styles.colorSwatchActive,
                    ]}
                  />
                );
              })}
            </View>
            <Text style={styles.label}>Serviços que realiza</Text>
            <View style={styles.chips}>
              {services.map((s) => {
                const active = serviceIds.includes(s.id);
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => toggleService(s.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isEditing ? (
              <Pressable
                onPress={() => setResetPassword((v) => !v)}
                style={[styles.resetChip, resetPassword && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    resetPassword && styles.chipTextActive,
                  ]}
                >
                  {resetPassword
                    ? '✓ Gerar novo link de senha'
                    : 'Gerar novo link de senha'}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                Ao salvar, um link de uso único (válido por 2h) será gerado para
                o profissional definir a senha.
              </Text>
            )}
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
        {employees.map((e) => (
          <View key={e.id} style={styles.entity}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.meta}>{e.email || 'Sem e-mail de acesso'}</Text>
                <Text style={styles.meta}>
                  {e.phone ? e.phone : 'Sem telefone'}
                </Text>
                <Text style={styles.meta}>
                  {(e.services || []).map((s) => s.name).join(', ') || '—'}
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: e.color }]} />
            </View>
            <View style={styles.cardActions}>
              <View style={styles.cardActionsRow}>
                <Pressable onPress={() => startEdit(e)}>
                  <Text style={styles.edit}>Editar</Text>
                </Pressable>
                <Pressable onPress={() => remove(e.id)}>
                  <Text style={styles.delete}>Remover</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => sendInviteWhatsapp(e.id)}
                disabled={sendingWa}
                style={styles.waAction}
              >
                <Text style={styles.edit}>
                  {sendingWa && inviteEmployeeId === e.id
                    ? 'Enviando…'
                    : 'Enviar senha no WhatsApp'}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
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
  passwordCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 24,
    gap: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: d.ink },
  formGrid: { gap: 12 },
  label: { fontWeight: '600', color: d.ink, fontSize: 14 },
  hint: { color: d.muted, fontSize: 13, lineHeight: 20 },
  code: { fontFamily: 'monospace', color: d.ink },
  tempPass: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: d.ink,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: d.ink,
    transform: [{ scale: 1.08 }],
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  resetChip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  chipActive: { borderColor: d.accent, backgroundColor: '#eff6ff' },
  chipText: { color: d.ink, fontSize: 13 },
  chipTextActive: { fontWeight: '700' },
  error: { color: '#dc2626', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    padding: 20,
    width: 280,
    gap: 12,
  },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: { fontSize: 17, fontWeight: '700', color: d.ink },
  meta: { color: d.muted, fontSize: 13, marginTop: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  cardActions: { gap: 10 },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  waAction: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  edit: { color: d.accent, fontWeight: '600' },
  delete: { color: '#dc2626', fontWeight: '600' },
});
