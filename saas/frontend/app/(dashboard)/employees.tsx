import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Employee } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { formatPhone, useDashboard } from '@/src/context/DashboardContext';
import {
  SofButton,
  SofCard,
  SofEmptyState,
  SofErrorBanner,
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
  EMPLOYEE_COLORS,
  EmployeeFormModal,
} from '@/src/features/employees/EmployeeFormModal';
import { d } from '@/src/theme/dashboard';

export default function EmployeesScreen() {
  const { employees, setEmployees, services } = useDashboard();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteExpiresAt, setInviteExpiresAt] = useState('');
  const [inviteEmployeeId, setInviteEmployeeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [error, setError] = useState('');

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  const nextDefaultColor = () =>
    EMPLOYEE_COLORS[employees.length % EMPLOYEE_COLORS.length];

  const startCreate = () => {
    if (services.length === 0) {
      router.push('/(dashboard)/services?create=1');
      return;
    }
    setEditing(null);
    setError('');
    setModalOpen(true);
  };

  const startEdit = (employee: Employee) => {
    setEditing(employee);
    setError('');
    setModalOpen(true);
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao enviar no WhatsApp.',
      );
    } finally {
      setSendingWa(false);
    }
  };

  const onSaved = (result: {
    employee: Employee;
    resetLink?: string;
    expiresAt?: string;
  }) => {
    setEmployees((prev) => {
      const exists = prev.some((e) => e.id === result.employee.id);
      return exists
        ? prev.map((e) => (e.id === result.employee.id ? result.employee : e))
        : [...prev, result.employee];
    });
    if (result.resetLink) {
      showInvite(result.resetLink, result.expiresAt, result.employee.id);
    }
  };

  const remove = async (id: string) => {
    await dashboardApi.deleteEmployee(id);
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    if (editing?.id === id) closeModal();
  };

  return (
    <View style={ec.page}>
      <SofPageHeader
        title="Profissionais"
        subtitle="Equipe, serviços e acesso à agenda"
        action={
          <SofButton
            title="Adicionar profissional"
            variant="dark"
            theme="dashboard"
            onPress={startCreate}
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

      {employees.length === 0 && !inviteLink ? (
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

      <EmployeeFormModal
        visible={modalOpen}
        onClose={closeModal}
        employee={editing}
        services={services}
        defaultColor={nextDefaultColor()}
        onSaved={onSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  passwordCard: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    gap: 4,
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
    justifyContent: 'space-between',
    width: '100%',
  },
});
