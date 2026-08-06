import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Employee, Service } from '@/src/api/types';
import { dashboardApi } from '@/src/api/endpoints';
import { SofButton, SofErrorBanner, SofInput } from '@/src/components/ui';
import { EntityFormModal } from '@/src/features/dashboard/EntityFormModal';
import {
  hasFieldErrors,
  maskBrPhone,
  normalizePhoneDigits,
  validateEmployeeFields,
  type EmployeeFieldErrors,
} from '@/src/lib/validation';
import { d } from '@/src/theme/dashboard';

const EMPLOYEE_COLORS = [
  '#3d4743',
  '#c19a6b',
  '#5b7a6e',
  '#8f6e45',
  '#6e7873',
  '#a67c52',
] as const;

function normalizeHex(raw: string): string {
  const color = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  return EMPLOYEE_COLORS[0];
}

export type EmployeeInviteResult = {
  employee: Employee;
  resetLink?: string;
  expiresAt?: string;
};

type EmployeeFormModalProps = {
  visible: boolean;
  onClose: () => void;
  employee?: Employee | null;
  services: Service[];
  defaultColor?: string;
  onSaved: (result: EmployeeInviteResult) => void;
};

export function EmployeeFormModal({
  visible,
  onClose,
  employee = null,
  services,
  defaultColor = EMPLOYEE_COLORS[0],
  onSaved,
}: EmployeeFormModalProps) {
  const isEditing = Boolean(employee);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [color, setColor] = useState(defaultColor);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [resetPassword, setResetPassword] = useState(false);
  const [canHandleHandoffs, setCanHandleHandoffs] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EmployeeFieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(employee?.name || '');
    setEmail(employee?.email || '');
    setPhone(employee ? maskBrPhone(employee.phone || '') : '');
    setColor(
      normalizeHex(employee?.color || defaultColor || EMPLOYEE_COLORS[0]),
    );
    setServiceIds((employee?.services || []).map((s) => s.id));
    setResetPassword(false);
    setCanHandleHandoffs(Boolean(employee?.canHandleHandoffs));
    setFieldErrors({});
    setError('');
    setTouched(false);
    setLoading(false);
  }, [visible, employee, defaultColor]);

  const clearField = (key: keyof EmployeeFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleService = (id: string) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    clearField('services');
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

    const hexOk = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color.trim());
    if (!hexOk) {
      setError('Informe uma cor hexadecimal válida (#RGB ou #RRGGBB).');
      return;
    }

    setLoading(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizePhoneDigits(phone),
        serviceIds,
        color: normalizeHex(color),
        canHandleHandoffs,
      };
      if (employee) {
        const { employee: saved, resetLink, expiresAt } =
          await dashboardApi.updateEmployee(employee.id, {
            ...body,
            resetPassword,
          });
        onSaved({ employee: saved, resetLink, expiresAt });
      } else {
        const { employee: saved, resetLink, expiresAt } =
          await dashboardApi.createEmployee(body);
        onSaved({ employee: saved, resetLink, expiresAt });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <EntityFormModal
      visible={visible}
      title={isEditing ? 'Editar profissional' : 'Novo profissional'}
      actions={
        <>
          <SofButton
            title={loading ? 'Salvando…' : 'Salvar'}
            variant="dark"
            theme="dashboard"
            onPress={save}
            loading={loading}
            disabled={loading}
          />
          <SofButton
            title="Fechar"
            variant="light"
            theme="dashboard"
            onPress={onClose}
            disabled={loading}
          />
        </>
      }
    >
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
          setPhone(t);
          clearField('phone');
        }}
        theme="dashboard"
        placeholder="(11) 99999-8888"
        mask="phone"
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
        placeholder="profissional@negocio.com"
        mask="email"
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
        {Platform.OS === 'web' ? (
          <View
            style={[
              styles.colorSwatch,
              styles.customSwatch,
              { backgroundColor: normalizeHex(color) },
              !(EMPLOYEE_COLORS as readonly string[]).includes(
                normalizeHex(color),
              ) && styles.colorSwatchActive,
            ]}
            accessibilityLabel="Escolher qualquer cor"
          >
            {createElement('input', {
              type: 'color',
              value: normalizeHex(color),
              title: 'Escolher qualquer cor',
              'aria-label': 'Escolher qualquer cor',
              onInput: (e: { target: { value: string } }) => {
                setColor(normalizeHex(e.target.value));
              },
              onChange: (e: { target: { value: string } }) => {
                setColor(normalizeHex(e.target.value));
              },
              style: {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                border: 'none',
                padding: 0,
              },
            })}
            <Text style={styles.customSwatchGlyph}>+</Text>
          </View>
        ) : null}
      </View>
      {Platform.OS === 'web' ? (
        <Text style={styles.colorHint}>
          Presets ou + para abrir o seletor e escolher qualquer cor
        </Text>
      ) : (
        <SofInput
          label="Código da cor (hex)"
          value={color}
          onChangeText={(t) => {
            const next = t.trim().toLowerCase();
            if (next === '' || next === '#') {
              setColor('#');
              return;
            }
            const withHash = next.startsWith('#') ? next : `#${next}`;
            if (/^#[0-9a-f]{0,6}$/i.test(withHash)) {
              setColor(
                withHash.length === 7 ? normalizeHex(withHash) : withHash,
              );
            }
          }}
          theme="dashboard"
          placeholder="#3d4743"
          autoCapitalize="none"
        />
      )}
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {touched && fieldErrors.services ? (
        <SofErrorBanner message={fieldErrors.services} />
      ) : null}
      <Pressable
        onPress={() => setCanHandleHandoffs((v) => !v)}
        style={[styles.resetChip, canHandleHandoffs && styles.chipActive]}
      >
        <Text
          style={[styles.chipText, canHandleHandoffs && styles.chipTextActive]}
        >
          {canHandleHandoffs
            ? 'Pode atender handoffs (ligado)'
            : 'Pode atender handoffs (desligado)'}
        </Text>
      </Pressable>
      <Text style={styles.colorHint}>
        Com a opção ligada, o profissional vê a fila de Atendimentos no portal e
        pode assumir conversas de clientes.
      </Text>
      {isEditing ? (
        <Pressable
          onPress={() => setResetPassword((v) => !v)}
          style={[styles.resetChip, resetPassword && styles.chipActive]}
        >
          <Text
            style={[styles.chipText, resetPassword && styles.chipTextActive]}
          >
            {resetPassword
              ? '✓ Gerar novo link de senha'
              : 'Gerar novo link de senha'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.hint}>
          Ao salvar, um link de uso único (válido por 2h) será gerado para o
          profissional definir a senha.
        </Text>
      )}
      {error ? <SofErrorBanner message={error} /> : null}
    </EntityFormModal>
  );
}

export { EMPLOYEE_COLORS, normalizeHex };

const styles = StyleSheet.create({
  label: {
    fontWeight: '600',
    color: d.mutedStrong,
    fontSize: 14,
    fontFamily: d.fonts.bodyMedium,
    marginTop: 8,
    marginBottom: 6,
  },
  hint: {
    color: d.muted,
    fontSize: 13,
    fontFamily: d.fonts.body,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchActive: {
    borderColor: d.ink,
  },
  customSwatch: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  customSwatchGlyph: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  colorHint: {
    color: d.muted,
    fontSize: 12,
    fontFamily: d.fonts.body,
    marginBottom: 8,
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
  chipActive: { borderColor: d.accent, backgroundColor: d.accentSoft },
  chipText: { color: d.ink, fontSize: 13, fontFamily: d.fonts.body },
  chipTextActive: { fontWeight: '700', fontFamily: d.fonts.bodyMedium },
  resetChip: {
    borderWidth: 1,
    borderColor: d.line,
    borderRadius: d.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: d.surface,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
