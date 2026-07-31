import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { Appointment } from '@/src/api/types';
import { useDashboard } from '@/src/context/DashboardContext';
import { SofButton } from '@/src/components/ui';
import { d } from '@/src/theme/dashboard';

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const COMPACT_BREAKPOINT = 720;
const VIEW_MODE_KEY = 'sof_agenda_view';

type AgendaViewMode = 'separated' | 'merged';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localDateStr(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Em tela estreita o ano só rouba linha do subtítulo. */
function shortDate(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

function getWeekDates(offset: number) {
  const today = new Date();
  const first = today.getDate() - today.getDay() + offset * 7;
  return Array.from(
    { length: 7 },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), first + i),
  );
}

function readStoredViewMode(): AgendaViewMode {
  try {
    if (typeof localStorage === 'undefined') return 'separated';
    const raw = localStorage.getItem(VIEW_MODE_KEY);
    return raw === 'merged' ? 'merged' : 'separated';
  } catch {
    return 'separated';
  }
}

function storeViewMode(mode: AgendaViewMode) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function AgendaView({
  onSelectAppointment,
  onCreateAppointment,
}: {
  onSelectAppointment: (a: Appointment) => void;
  onCreateAppointment: (draft: { employeeId: string; date: string }) => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < COMPACT_BREAKPOINT;
  const colW = Math.max(110, Math.min(140, (width - 220) / 7));
  const { employees, appointments, getService } = useDashboard();
  const [weekOffset, setWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<AgendaViewMode>(readStoredViewMode);
  /** IDs de profissionais com a linha recolhida (só 1º horário por dia). */
  const [collapsedEmpIds, setCollapsedEmpIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedDate, setSelectedDate] = useState(() =>
    localDateStr(new Date()),
  );

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayStr = localDateStr(new Date());
  const merged = viewMode === 'merged';
  const defaultEmployeeId = employees[0]?.id || '';

  const empById = useMemo(() => {
    const map = new Map(employees.map((e) => [e.id, e]));
    return map;
  }, [employees]);

  useEffect(() => {
    const inWeek = weekDates.some((day) => localDateStr(day) === selectedDate);
    if (inWeek) return;
    const todayInWeek = weekDates.find(
      (day) => localDateStr(day) === todayStr,
    );
    setSelectedDate(localDateStr(todayInWeek || weekDates[0]));
  }, [weekDates, selectedDate, todayStr]);

  const setMode = (mode: AgendaViewMode) => {
    setViewMode(mode);
    storeViewMode(mode);
  };

  const toggleCollapsed = (employeeId: string) => {
    setCollapsedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  };

  const dayApptsFor = (employeeId: string, dateStr: string) =>
    appointments
      .filter(
        (a) =>
          (a.status === 'scheduled' || a.status === 'completed') &&
          a.employeeId === employeeId &&
          a.date === dateStr,
      )
      .sort((a, b) => a.time.localeCompare(b.time));

  const mergedDayAppts = (dateStr: string) =>
    appointments
      .filter(
        (a) =>
          (a.status === 'scheduled' || a.status === 'completed') &&
          a.date === dateStr,
      )
      .sort((a, b) => a.time.localeCompare(b.time));

  const renderApptCard = (
    appt: Appointment,
    opts?: { collapsed?: boolean; showEmployee?: boolean },
  ) => {
    const isBlock = appt.kind === 'block';
    const isCompleted = appt.status === 'completed';
    const collapsed = !!opts?.collapsed;
    const emp = empById.get(appt.employeeId);
    return (
      <Pressable
        key={appt.id}
        onPress={(e) => {
          e?.stopPropagation?.();
          onSelectAppointment(appt);
        }}
        style={[
          styles.appt,
          appt.source === 'whatsapp' && styles.apptWa,
          isBlock && styles.apptBlock,
          isCompleted && styles.apptCompleted,
          collapsed && styles.apptCollapsed,
          emp?.color ? { borderLeftColor: emp.color } : null,
        ]}
      >
        <Text style={styles.apptTime}>{appt.time}</Text>
        {opts?.showEmployee && emp ? (
          <Text style={styles.apptEmp} numberOfLines={1}>
            {emp.name}
          </Text>
        ) : null}
        <Text style={styles.apptClient} numberOfLines={1}>
          {isBlock ? appt.title || 'Evento' : appt.clientName}
        </Text>
        {!collapsed ? (
          !isBlock ? (
            <Text style={styles.apptSvc}>
              {getService(appt.serviceId || '')?.name}
            </Text>
          ) : (
            <Text style={styles.apptSvc}>
              {appt.durationMinutes
                ? `${appt.durationMinutes} min`
                : 'Bloqueio'}
              {appt.recurrenceGroupId ? ' · recorrente' : ''}
            </Text>
          )
        ) : null}
        {!collapsed && isCompleted ? (
          <Text style={styles.doneBadge}>Concluído</Text>
        ) : null}
        {!collapsed && !isCompleted && appt.source === 'whatsapp' ? (
          <Text style={styles.waBadge}>WhatsApp</Text>
        ) : null}
      </Pressable>
    );
  };

  const weekLabel = isCompact
    ? `${shortDate(weekDates[0])} a ${shortDate(weekDates[6])}`
    : `${weekDates[0].toLocaleDateString('pt-BR')} a ${weekDates[6].toLocaleDateString('pt-BR')}`;

  const weekNav = [
    {
      key: 'prev',
      title: isCompact ? 'Ant.' : 'Semana Anterior',
      onPress: () => setWeekOffset((w) => w - 1),
    },
    { key: 'today', title: 'Hoje', onPress: () => setWeekOffset(0) },
    {
      key: 'next',
      title: isCompact ? 'Próx.' : 'Próxima Semana',
      onPress: () => setWeekOffset((w) => w + 1),
    },
  ];

  return (
    <View style={{ gap: isCompact ? 20 : 32 }}>
      <View style={[styles.panelHead, isCompact && styles.panelHeadCompact]}>
        <View style={styles.headCopy}>
          <Text style={[styles.h2, isCompact && styles.h2Compact]}>
            Agenda Semanal
          </Text>
          <Text style={[styles.sub, isCompact && styles.subCompact]}>
            {isCompact
              ? `${weekLabel} — escolha o dia`
              : `${weekLabel} — clique numa célula para agendar ou em um horário para editar`}
          </Text>
        </View>
        <View style={[styles.toolbar, isCompact && styles.toolbarCompact]}>
          <View style={styles.viewToggle}>
            <Pressable
              onPress={() => setMode('separated')}
              style={[styles.viewChip, !merged && styles.viewChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: !merged }}
            >
              <Text
                style={[
                  styles.viewChipText,
                  !merged && styles.viewChipTextActive,
                ]}
              >
                Separada
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('merged')}
              style={[styles.viewChip, merged && styles.viewChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: merged }}
            >
              <Text
                style={[
                  styles.viewChipText,
                  merged && styles.viewChipTextActive,
                ]}
              >
                Unificada
              </Text>
            </Pressable>
          </View>
          <View style={[styles.weekNav, isCompact && styles.weekNavCompact]}>
            {weekNav.map((item) => (
              <SofButton
                key={item.key}
                title={item.title}
                variant="light"
                theme="dashboard"
                onPress={item.onPress}
              />
            ))}
          </View>
        </View>
      </View>

      {employees.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Nenhum profissional cadastrado ainda. Adicione um na aba
            Profissionais.
          </Text>
        </View>
      ) : isCompact ? (
        <View style={styles.compactRoot}>
          <View style={styles.dayStrip}>
            {weekDates.map((day) => {
              const ds = localDateStr(day);
              const isToday = ds === todayStr;
              const active = ds === selectedDate;
              const count = appointments.filter(
                (a) =>
                  (a.status === 'scheduled' || a.status === 'completed') &&
                  a.date === ds,
              ).length;
              return (
                <Pressable
                  key={ds}
                  onPress={() => setSelectedDate(ds)}
                  style={[
                    styles.dayChip,
                    isToday && !active && styles.dayChipToday,
                    active && styles.dayChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.dayChipDow,
                      active && styles.dayChipTextActive,
                    ]}
                  >
                    {DOW[day.getDay()]}
                  </Text>
                  <Text
                    style={[
                      styles.dayChipDom,
                      active && styles.dayChipTextActive,
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  {count > 0 ? (
                    <Text
                      style={[
                        styles.dayChipCount,
                        active && styles.dayChipTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  ) : (
                    <Text style={styles.dayChipCountPlaceholder}> </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {merged ? (
            <View style={styles.empCard}>
              <View style={styles.empCardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.empName}>Todos os profissionais</Text>
                  <Text style={styles.specialty}>
                    Horários unificados do dia
                  </Text>
                </View>
                <SofButton
                  title="+ Agendar"
                  variant="light"
                  theme="dashboard"
                  onPress={() =>
                    onCreateAppointment({
                      employeeId: defaultEmployeeId,
                      date: selectedDate,
                    })
                  }
                />
              </View>
              {mergedDayAppts(selectedDate).length === 0 ? (
                <Pressable
                  onPress={() =>
                    onCreateAppointment({
                      employeeId: defaultEmployeeId,
                      date: selectedDate,
                    })
                  }
                  style={styles.compactEmpty}
                >
                  <Text style={styles.cellHint}>
                    Livre — toque para agendar
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.compactAppts}>
                  {mergedDayAppts(selectedDate).map((appt) =>
                    renderApptCard(appt, { showEmployee: true }),
                  )}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.compactList}>
              {employees.map((emp) => {
                const dayAppts = dayApptsFor(emp.id, selectedDate);
                return (
                  <View
                    key={emp.id}
                    style={[
                      styles.empCard,
                      { borderLeftColor: emp.color || d.accent },
                    ]}
                  >
                    <View style={styles.empCardHead}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.empName} numberOfLines={1}>
                          {emp.name}
                        </Text>
                        <Text style={styles.specialty} numberOfLines={1}>
                          {(emp.services || []).map((s) => s.name).join(', ') ||
                            '—'}
                        </Text>
                      </View>
                      <SofButton
                        title="+ Agendar"
                        variant="light"
                        theme="dashboard"
                        onPress={() =>
                          onCreateAppointment({
                            employeeId: emp.id,
                            date: selectedDate,
                          })
                        }
                      />
                    </View>
                    {dayAppts.length === 0 ? (
                      <Pressable
                        onPress={() =>
                          onCreateAppointment({
                            employeeId: emp.id,
                            date: selectedDate,
                          })
                        }
                        style={styles.compactEmpty}
                      >
                        <Text style={styles.cellHint}>
                          Livre — toque para agendar
                        </Text>
                      </Pressable>
                    ) : (
                      <View style={styles.compactAppts}>
                        {dayAppts.map((appt) => renderApptCard(appt))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={styles.calendarScroll}
        >
          <View>
            <View style={styles.headerRow}>
              <View style={[styles.corner, { width: 150 }]}>
                <Text style={styles.headerText}>
                  {merged ? 'Agenda' : 'Profissional'}
                </Text>
              </View>
              {weekDates.map((day) => {
                const ds = localDateStr(day);
                const isToday = ds === todayStr;
                return (
                  <View
                    key={ds}
                    style={[
                      styles.dayHeader,
                      { width: colW },
                      isToday && styles.dayHeaderToday,
                    ]}
                  >
                    <Text style={[styles.dow, isToday && { color: '#fff' }]}>
                      {DOW[day.getDay()]}
                    </Text>
                    <Text style={[styles.dom, isToday && { color: '#fff' }]}>
                      {day.getDate()}
                    </Text>
                  </View>
                );
              })}
              {!merged ? (
                <View style={[styles.dayHeader, styles.actionHeader]}>
                  <Text style={styles.dow}> </Text>
                </View>
              ) : null}
            </View>

            {merged ? (
              <View style={styles.row}>
                <View
                  style={[
                    styles.empCell,
                    { width: 150, borderLeftColor: d.accent },
                  ]}
                >
                  <Text style={styles.empName}>Todos</Text>
                  <Text style={styles.specialty}>
                    {employees.length} profissionais
                  </Text>
                </View>
                {weekDates.map((day) => {
                  const ds = localDateStr(day);
                  const dayAppts = mergedDayAppts(ds);
                  return (
                    <Pressable
                      key={ds}
                      onPress={() =>
                        onCreateAppointment({
                          employeeId: defaultEmployeeId,
                          date: ds,
                        })
                      }
                      style={[
                        styles.cell,
                        {
                          width: colW,
                          borderLeftColor: d.accent,
                        },
                      ]}
                    >
                      {dayAppts.length === 0 ? (
                        <Text style={styles.cellHint}>+ Agendar</Text>
                      ) : null}
                      {dayAppts.map((appt) =>
                        renderApptCard(appt, { showEmployee: true }),
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              employees.map((emp) => {
                const collapsed = collapsedEmpIds.has(emp.id);
                return (
                  <View key={emp.id} style={styles.row}>
                    <View
                      style={[
                        styles.empCell,
                        { width: 150, borderLeftColor: emp.color || d.accent },
                        collapsed && styles.empCellCollapsed,
                      ]}
                    >
                      <Text style={styles.empName} numberOfLines={1}>
                        {emp.name}
                      </Text>
                      {!collapsed ? (
                        <Text style={styles.specialty} numberOfLines={2}>
                          {(emp.services || []).map((s) => s.name).join(', ') ||
                            '—'}
                        </Text>
                      ) : null}
                    </View>
                    {weekDates.map((day) => {
                      const ds = localDateStr(day);
                      const dayAppts = dayApptsFor(emp.id, ds);
                      const visibleAppts = collapsed
                        ? dayAppts.slice(0, 1)
                        : dayAppts;
                      const hiddenCount = collapsed
                        ? Math.max(0, dayAppts.length - 1)
                        : 0;
                      return (
                        <Pressable
                          key={ds}
                          onPress={() =>
                            onCreateAppointment({
                              employeeId: emp.id,
                              date: ds,
                            })
                          }
                          style={[
                            styles.cell,
                            {
                              width: colW,
                              borderLeftColor: emp.color || d.accent,
                            },
                            collapsed && styles.cellCollapsed,
                          ]}
                        >
                          {dayAppts.length === 0 ? (
                            <Text style={styles.cellHint}>+ Agendar</Text>
                          ) : null}
                          {visibleAppts.map((appt) =>
                            renderApptCard(appt, { collapsed }),
                          )}
                          {hiddenCount > 0 ? (
                            <Pressable
                              onPress={(e) => {
                                e?.stopPropagation?.();
                                toggleCollapsed(emp.id);
                              }}
                            >
                              <Text style={styles.moreHint}>
                                +{hiddenCount}
                              </Text>
                            </Pressable>
                          ) : null}
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={() => toggleCollapsed(emp.id)}
                      style={[
                        styles.actionCell,
                        collapsed && styles.actionCellCollapsed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        collapsed
                          ? `Expandir agenda de ${emp.name}`
                          : `Recolher agenda de ${emp.name}`
                      }
                    >
                      <Text style={styles.actionCellIcon}>
                        {collapsed ? '▾' : '▴'}
                      </Text>
                      <Text style={styles.actionCellLabel}>
                        {collapsed ? 'Expandir' : 'Recolher'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
  },
  // Em coluna o título ocupa a linha inteira e não é comprimido pela toolbar.
  panelHeadCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 12,
  },
  headCopy: { flex: 1, minWidth: 0 },
  h2: {
    fontSize: 28,
    fontWeight: '700',
    color: d.ink,
    fontFamily: d.fonts.displayBold,
    letterSpacing: -0.4,
  },
  h2Compact: { fontSize: 22 },
  sub: {
    color: d.muted,
    fontSize: 14,
    marginTop: 8,
    fontFamily: d.fonts.body,
  },
  subCompact: { fontSize: 13, marginTop: 4 },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  // `width: '100%'` (e não `alignSelf: 'stretch'`) é o que garante a linha inteira
  // para centrar toggle e navegação — stretch só valeria no eixo cruzado do cabeçalho.
  toolbarCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    flexWrap: 'nowrap',
    gap: 8,
  },
  weekNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
  },
  weekNavCompact: { justifyContent: 'center', gap: 8 },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: d.radiusSm,
    padding: 3,
    gap: 2,
  },
  viewChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  viewChipActive: {
    backgroundColor: d.surface,
    borderWidth: 1,
    borderColor: d.line,
  },
  viewChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: d.muted,
  },
  viewChipTextActive: {
    color: d.ink,
  },
  empty: {
    backgroundColor: d.surface,
    padding: 48,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    alignItems: 'center',
  },
  emptyText: { color: d.muted },
  compactRoot: { gap: 16 },
  // A semana inteira cabe na largura: nenhum dia fica escondido atrás de scroll.
  dayStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  dayChip: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: d.radiusSm,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    gap: 2,
  },
  dayChipToday: {
    borderWidth: 1,
    borderColor: d.accent,
  },
  dayChipActive: {
    backgroundColor: d.ink,
  },
  dayChipDow: {
    fontSize: 11,
    fontWeight: '600',
    color: d.muted,
  },
  dayChipDom: {
    fontSize: 18,
    fontWeight: '700',
    color: d.ink,
  },
  dayChipCount: {
    fontSize: 10,
    fontWeight: '700',
    color: d.accent,
    marginTop: 2,
  },
  dayChipCountPlaceholder: {
    fontSize: 10,
    marginTop: 2,
  },
  dayChipTextActive: {
    color: '#fff',
  },
  compactList: { gap: 12 },
  empCard: {
    backgroundColor: d.surface,
    borderRadius: d.radius,
    borderWidth: 1,
    borderColor: d.line,
    borderLeftWidth: 4,
    padding: 14,
    gap: 12,
  },
  empCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactEmpty: {
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  compactAppts: { gap: 8 },
  calendarScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerRow: { flexDirection: 'row', gap: 1, backgroundColor: d.line },
  corner: {
    backgroundColor: d.ink,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  dayHeader: {
    backgroundColor: '#f1f5f9',
    padding: 16,
    alignItems: 'center',
  },
  dayHeaderToday: { backgroundColor: d.ink },
  dow: { fontWeight: '600', fontSize: 14, color: d.ink },
  dom: { fontSize: 18, fontWeight: '700', marginTop: 4, color: d.ink },
  row: { flexDirection: 'row', gap: 1, backgroundColor: d.line },
  empCell: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderLeftWidth: 3,
    justifyContent: 'center',
  },
  empCellCollapsed: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  empName: { fontWeight: '600', fontSize: 14 },
  specialty: { fontSize: 11, color: d.muted, marginTop: 4 },
  actionHeader: {
    width: 88,
    backgroundColor: '#f1f5f9',
  },
  actionCell: {
    width: 88,
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 150,
  },
  actionCellCollapsed: {
    minHeight: 64,
  },
  actionCellIcon: {
    fontSize: 16,
    color: d.accent,
    fontWeight: '700',
  },
  actionCellLabel: {
    fontSize: 11,
    color: d.accent,
    fontWeight: '600',
    textAlign: 'center',
  },
  cell: {
    backgroundColor: '#fff',
    padding: 12,
    minHeight: 150,
    gap: 8,
    borderLeftWidth: 2,
  },
  cellCollapsed: {
    minHeight: 64,
    paddingVertical: 8,
    gap: 4,
  },
  cellHint: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  moreHint: {
    color: d.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  appt: {
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: d.accent,
    padding: 8,
    borderRadius: d.radiusSm,
  },
  apptCollapsed: {
    paddingVertical: 6,
  },
  apptWa: { borderLeftColor: d.waGreen },
  apptBlock: {
    borderLeftColor: '#64748b',
    backgroundColor: '#f8fafc',
  },
  apptCompleted: {
    opacity: 0.72,
    borderLeftColor: '#16a34a',
  },
  apptTime: { fontWeight: '600', fontSize: 12 },
  apptEmp: {
    color: d.accent,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  apptClient: { color: '#475569', marginTop: 4, fontSize: 12 },
  apptSvc: { color: '#94a3b8', fontSize: 11, marginTop: 4 },
  waBadge: {
    fontSize: 10,
    color: d.waGreenText,
    fontWeight: '700',
    marginTop: 4,
  },
  doneBadge: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: '700',
    marginTop: 4,
  },
});
