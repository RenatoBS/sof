import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Employee } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofErrorBanner,
  SofInput,
  SofPageHeader,
  SofRowActions,
} from '@/src/components/ui';
import {
  hasFieldErrors,
  maskBrPhone,
  normalizePhoneDigits,
  validateEmployeeFields,
  type EmployeeFieldErrors,
} from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

const EMPLOYEE_COLORS = [
  '#3D4743',
  '#C19A6B',
  '#5B7A6E',
  '#8F6E45',
  '#6E7873',
  '#A67C52',
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
  const [fieldErrors, setFieldErrors] = useState<EmployeeFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteEmployeeId, setInviteEmployeeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [waSent, setWaSent] = useState(false);

  const isEditing = !!editingId;

  const clearField = (key: keyof EmployeeFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const nextDefaultColor = () =>
    EMPLOYEE_COLORS[employees.length % EMPLOYEE_COLORS.length];

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    clearField('services');
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setColor(nextDefaultColor());
    setServiceIds([]);
    setResetPassword(false);
    setFieldErrors({});
    setError('');
    setTouched(false);
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
    setFieldErrors({});
    setError('');
    setTouched(false);
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
    setPhone(maskBrPhone(employee.phone || ''));
    setColor((employee.color || EMPLOYEE_COLORS[0]).toLowerCase());
    setServiceIds((employee.services || []).map((s) => s.id));
    setResetPassword(false);
    setFieldErrors({});
    setError('');
    setTouched(false);
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
    setTouched(true);
    const errors = validateEmployeeFields({
      name,
      phone,
      email,
      serviceIds,
    });
    setFieldErrors(errors);
    if (hasFieldErrors(errors)) return;

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizePhoneDigits(phone),
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
      <SofPageHeader
        title="Profissionais"
        subtitle="Gerencie a equipe e o acesso de cada profissional"
        action={
          <SofButton
            title={showForm ? 'Cancelar' : 'Adicionar profissional'}
            variant="dark"
            theme="dashboard"
            onPress={() => {
              if (showForm) resetForm();
              else startCreate();
            }}
          />
        }
      />

      {inviteLink ? (
        <SofCard style={styles.passwordCard}>
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
              title={waSent ? 'Enviado no WhatsApp' : 'Enviar no WhatsApp'}
              variant="dark"
              theme="dashboard"
              loading={sendingWa}
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
          {error ? <SofErrorBanner message={error} /> : null}
        </SofCard>
      ) : null}

      {showForm ? (
        <SofCard>
          <Text style={styles.cardTitle}>
            {isEditing ? 'Editar profissional' : 'Novo profissional'}
          </Text>
          <View style={styles.formGrid}>
            <SofInput
              label="Nome"
              value={name}
              onChangeText={(t) => {
                setName(t);
                clearField('name');
              }}
              theme="dashboard"
              placeholder="Nome completo"
              autoCapitalize="words"
              error={touched ? fieldErrors.name : undefined}
            />
            <SofInput
              label="Telefone"
              value={phone}
              onChangeText={(t) => {
                setPhone(maskBrPhone(t));
                clearField('phone');
              }}
              theme="dashboard"
              placeholder="(11) 99999-8888"
              keyboardType="phone-pad"
              error={touched ? fieldErrors.phone : undefined}
            />
            <SofInput
              label="E-mail de acesso"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearField('email');
              }}
              theme="dashboard"
              placeholder="profissional@salao.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={touched ? fieldErrors.email : undefined}
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
            {touched && fieldErrors.services ? (
              <SofErrorBanner message={fieldErrors.services} />
            ) : null}
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
          {error ? <SofErrorBanner message={error} /> : null}
          <View style={styles.actions}>
            <SofButton
              title={isEditing ? 'Salvar alterações' : 'Adicionar'}
              variant="dark"
              theme="dashboard"
              onPress={save}
              loading={loading}
              disabled={loading}
            />
            <SofButton
              title="Cancelar"
              variant="light"
              theme="dashboard"
              onPress={resetForm}
            />
          </View>
        </SofCard>
      ) : null}

      <View style={styles.grid}>
        {employees.map((e) => (
          <SofCard key={e.id} style={styles.entity}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.meta}>{e.email || 'Sem e-mail de acesso'}</Text>
                <Text style={styles.meta}>
                  {e.phone ? formatPhone(e.phone) : 'Sem telefone'}
                </Text>
                <Text style={styles.meta}>
                  {(e.services || []).map((s) => s.name).join(', ') || '—'}
                </Text>
              </View>
              <View style={[styles.dot, { backgroundColor: e.color }]} />
            </View>
            <View style={styles.cardActions}>
              <SofRowActions
                onEdit={() => startEdit(e)}
                onRemove={() => remove(e.id)}
              />
              <Pressable
                onPress={() => sendInviteWhatsapp(e.id)}
                disabled={sendingWa}
                style={styles.waAction}
                accessibilityRole="button"
                accessibilityLabel="Enviar senha no WhatsApp"
              >
                <Text style={styles.waText}>
                  {sendingWa && inviteEmployeeId === e.id
                    ? 'Enviando…'
                    : 'Enviar senha no WhatsApp'}
                </Text>
              </Pressable>
            </View>
          </SofCard>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24 },
  passwordCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    marginBottom: 4,
  },
  formGrid: { gap: 12 },
  label: {
    fontWeight: '600',
    color: d.mutedStrong,
    fontSize: 14,
    fontFamily: d.fonts.bodyMedium,
  },
  hint: { color: d.muted, fontSize: 13, lineHeight: 20, fontFamily: d.fonts.body },
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
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: d.surface,
  },
  resetChip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: d.surface,
    alignSelf: 'flex-start',
  },
  chipActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  chipText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  chipTextActive: { fontWeight: '700', fontFamily: d.fonts.bodyMedium },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  entity: {
    minWidth: 280,
    flexGrow: 1,
    flexBasis: 280,
    gap: 12,
  },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.bodyMedium,
  },
  meta: { color: d.muted, fontSize: 13, marginTop: 4, fontFamily: d.fonts.body },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 4 },
  cardActions: { gap: 10 },
  waAction: {
    alignSelf: 'flex-start',
    paddingTop: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  waText: {
    color: d.accent,
    fontWeight: '600',
    fontFamily: d.fonts.bodyMedium,
    fontSize: 14,
  },
});
