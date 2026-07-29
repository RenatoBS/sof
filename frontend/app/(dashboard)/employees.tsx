import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Employee } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofErrorBanner,
  SofInput,
  SofPageHeader,
  SofRowActions,
} from '@/src/components/ui';
import {
  EntityAvatar,
  EntityCardBody,
  EntityCardFooter,
  EntityChip,
  EntityStat,
  entityCardStyles as ec,
} from '@/src/features/dashboard/EntityCard';
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
    <View style={ec.page}>
      <SofPageHeader
        title="Profissionais"
        subtitle="Equipe, serviços e acesso à agenda"
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
      {employees.length > 0 ? (
        <Text style={ec.count}>
          {employees.length}{' '}
          {employees.length === 1 ? 'profissional' : 'profissionais'}
        </Text>
      ) : null}

      {inviteLink ? (
        <SofCard style={styles.passwordCard}>
          <Text style={ec.formTitle}>Link de acesso gerado</Text>
          <Text style={ec.formHint}>
            Envie pelo WhatsApp do estabelecimento ou copie o link. Uso único,
            expira em 2 horas — ao abrir, o profissional define a senha e entra
            na agenda.
          </Text>
          {inviteExpiresAt ? (
            <Text style={ec.formHint}>
              Válido até {new Date(inviteExpiresAt).toLocaleString('pt-BR')}
            </Text>
          ) : null}
          <Text selectable style={styles.tempPass}>
            {inviteLink}
          </Text>
          <View style={ec.formActions}>
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
          <Text style={ec.formTitle}>
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
              <Text style={ec.formHint}>
                Ao salvar, um link de uso único (válido por 2h) será gerado para
                o profissional definir a senha.
              </Text>
            )}
          </View>
          {error ? <SofErrorBanner message={error} /> : null}
          <View style={ec.formActions}>
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

      {employees.length === 0 && !showForm && !inviteLink ? (
        <SofCard padded={false}>
          <SofEmptyState
            title="Nenhum profissional ainda"
            body={
              services.length === 0
                ? 'Cadastre ao menos um serviço e depois adicione a equipe.'
                : 'Adicione a equipe para montar a agenda e liberar acesso.'
            }
            action={
              <SofButton
                title={
                  services.length === 0
                    ? 'Cadastrar serviço'
                    : 'Adicionar profissional'
                }
                variant="dark"
                theme="dashboard"
                onPress={startCreate}
              />
            }
          />
        </SofCard>
      ) : (
        <View style={ec.grid}>
          {employees.map((e) => {
            const serviceNames = (e.services || []).map((s) => s.name);
            return (
              <SofCard key={e.id} padded={false} style={ec.entity}>
                <EntityCardBody>
                  <View style={styles.head}>
                    <EntityAvatar
                      name={e.name}
                      color={e.color || d.accent}
                      size={48}
                    />
                    <View style={styles.headCopy}>
                      <Text style={styles.name} numberOfLines={2}>
                        {e.name}
                      </Text>
                      <Text style={styles.email} numberOfLines={1}>
                        {e.email || 'Sem e-mail de acesso'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.stats}>
                    <EntityStat
                      label="Telefone"
                      value={e.phone ? formatPhone(e.phone) : '—'}
                    />
                  </View>
                  <View style={styles.serviceWrap}>
                    <Text style={styles.servicesLabel}>Serviços</Text>
                    <View style={styles.serviceChips}>
                      {serviceNames.length ? (
                        serviceNames.slice(0, 4).map((label) => (
                          <EntityChip key={label} tone="accent">
                            {label}
                          </EntityChip>
                        ))
                      ) : (
                        <EntityChip tone="neutral">Nenhum</EntityChip>
                      )}
                      {serviceNames.length > 4 ? (
                        <EntityChip tone="neutral">
                          {`+${serviceNames.length - 4}`}
                        </EntityChip>
                      ) : null}
                    </View>
                  </View>
                </EntityCardBody>
                <EntityCardFooter>
                  <View style={styles.footerRow}>
                    <SofRowActions
                      onEdit={() => startEdit(e)}
                      onRemove={() => remove(e.id)}
                    />
                    <SofButton
                      title={
                        sendingWa && inviteEmployeeId === e.id
                          ? 'Enviando…'
                          : 'Senha no WhatsApp'
                      }
                      variant="light"
                      theme="dashboard"
                      onPress={() => sendInviteWhatsapp(e.id)}
                      disabled={sendingWa}
                      loading={sendingWa && inviteEmployeeId === e.id}
                    />
                  </View>
                </EntityCardFooter>
              </SofCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  passwordCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    gap: 4,
  },
  formGrid: { gap: 4 },
  label: {
    fontWeight: '600',
    color: d.mutedStrong,
    fontSize: 14,
    fontFamily: d.fonts.bodyMedium,
    marginTop: 6,
    marginBottom: 6,
  },
  tempPass: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: d.ink,
    fontFamily: 'monospace',
    lineHeight: 20,
    backgroundColor: d.fill,
    padding: 12,
    borderRadius: d.radiusSm,
    overflow: 'hidden',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
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
    marginTop: 4,
  },
  chipActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  chipText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  chipTextActive: { fontWeight: '700', fontFamily: d.fonts.bodyMedium },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headCopy: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.2,
  },
  email: {
    fontSize: 13,
    color: d.muted,
    fontFamily: d.fonts.body,
  },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceWrap: { gap: 8 },
  servicesLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: d.muted,
    fontFamily: d.fonts.bodyMedium,
  },
  serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
});
