import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Account, Employee, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../events/realtime.service';
import { serializeDates } from '../common/public-shapes';
import { normalizePhone } from '../common/phone';
import {
  hasScheduleConflict,
  listBusySlots,
  minutesToTime,
  timeToMinutes,
} from '../appointments/schedule-conflict';
import {
  checkWithinOpeningHours,
  normalizeOpeningHours,
} from '../account/opening-hours';
import { EmployeePasswordResetService } from '../employee-portal/employee-password-reset.service';
import { EmployeeBookingNotifyService } from './employee-booking-notify.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { hasFeature } from '../entitlements/feature-catalog';
import {
  APPT_STATUS,
  appointmentDurationMinutes,
  canCompleteAppointment,
} from '../appointments/appointment-status';
import type {
  WhatsappBotResult,
  WhatsappInteractiveMenu,
  WhatsappMenuChoice,
} from './whatsapp-bot.service';
import * as botCopy from './bot-copy';

type EmpSessionData = {
  role: 'employee';
  employeeId: string;
  serviceId?: string;
  date?: string;
  time?: string;
  clientName?: string;
  clientPhone?: string;
  title?: string;
  durationMinutes?: number;
  kind?: 'service' | 'block';
  cancelAppointmentId?: string;
};

const DATE_ONLY_RE = /^(\d{1,2})[\/\-](\d{1,2})$/;
const TIME_ONLY_RE = /^(\d{1,2}):(\d{2})$/;
const AFFIRMATIVE = ['sim', 's', 'confirmar', 'confirmo', 'ok', 'marca', 'marcar', 'fecha', 'fechado'];
const NEGATIVE = ['não', 'nao', 'n', 'cancelar'];
const CUSTOM_TIME_RE = /^(outro|outra|custom|time:custom)$/i;
const TIME_ID_RE = /^time:(\d{2}:\d{2})$/;
const HUMAN_REQUEST_RE =
  /\b(falar\s+com\s+(algu[eé]m|um\s+humano|(um[a]?\s+)?atendente|uma\s+pessoa(\s+real)?|a\s+conta|o\s+sal[aã]o)|quero\s+(um[a]?\s+)?atendente|chama(r)?\s+(um[a]?\s+)?atendente|me\s+passa\s+(pro|para\s+[oa])\s+atendente|atendimento\s+humano|ajuda\s+humana|n[aã]o\s+quero\s+falar\s+com\s+(rob[oô]|bot))\b/i;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 10_000;

const DAY_CHOICES: WhatsappMenuChoice[] = [
  { id: 'day:today', title: 'Hoje', description: 'Usar a data de hoje' },
  { id: 'day:tomorrow', title: 'Amanhã', description: 'Usar a data de amanhã' },
  {
    id: 'day:custom',
    title: 'Outra data',
    description: 'Informar o dia em dd/mm',
  },
];

const DURATION_CHOICES: WhatsappMenuChoice[] = [
  { id: 'dur:30', title: '30 min', description: 'Meia hora' },
  { id: 'dur:60', title: '1 hora', description: '60 minutos' },
  { id: 'dur:90', title: '1h30', description: '90 minutos' },
  { id: 'dur:120', title: '2 horas', description: '120 minutos' },
];

const CREATE_KIND_CHOICES: WhatsappMenuChoice[] = [
  {
    id: 'emp:book',
    title: 'Agendamento',
    description: 'Serviço para um cliente',
  },
  {
    id: 'emp:event',
    title: 'Evento',
    description: 'Almoço, médico, reunião…',
  },
];

@Injectable()
export class WhatsappEmployeeBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
    private readonly passwordReset: EmployeePasswordResetService,
    private readonly employeeBookingNotify: EmployeeBookingNotifyService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async findEmployee(accountId: string, phone: string) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    const include = {
      services: { include: { service: true } },
    } as const;

    const exact = await this.prisma.employee.findFirst({
      where: { accountId, phone: normalized },
      include,
    });
    if (exact) return exact;

    // WhatsApp manda com DDI (55…); cadastro do prof pode estar só com DDD.
    const employees = await this.prisma.employee.findMany({
      where: { accountId, NOT: { phone: '' } },
      include,
    });
    const strip55 = (p: string) =>
      p.startsWith('55') && p.length > 11 ? p.slice(2) : p;
    const incoming = strip55(normalized);
    return (
      employees.find((e) => {
        const stored = strip55(normalizePhone(e.phone));
        if (!stored || stored.length < 8) return false;
        return (
          stored === incoming ||
          normalized.endsWith(stored) ||
          stored.endsWith(incoming)
        );
      }) || null
    );
  }

  async handleIncomingMessage({
    account,
    employee,
    customerPhone,
    text,
  }: {
    account: Account;
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    };
    customerPhone: string;
    text: string;
  }): Promise<WhatsappBotResult> {
    const trimmed = String(text || '').trim();
    const lower = trimmed.toLowerCase();
    const phone = normalizePhone(customerPhone) || customerPhone;

    if (lower === '/reset' || lower === 'reset') {
      await this.resetSession(account.id, phone);
      return {
        replies: [
          botCopy.employeeMenuReset(employee.name),
        ],
      };
    }

    if (HUMAN_REQUEST_RE.test(trimmed)) {
      return this.requestHuman(account, employee, phone);
    }

    const session = await this.prisma.whatsappSession.findUnique({
      where: {
        accountId_customerPhone: {
          accountId: account.id,
          customerPhone: phone,
        },
      },
    });
    let step = session?.step || 'emp:start';
    let data = (session?.data || {}) as EmpSessionData;

    // Sessão antiga de cliente no mesmo número → reinicia como profissional
    if (!step.startsWith('emp:') || data.role !== 'employee') {
      step = 'emp:start';
      data = { role: 'employee', employeeId: employee.id };
      await this.saveSession(account.id, phone, { step, data });
    }

    // NLU em frase/áudio livre — no menu e também como interrupção
    // no meio do fluxo (ex.: estava escolhendo horário e mandou "cancela…").
    if (this.shouldTryEmployeeNlu(step, trimmed)) {
      const ents = await this.entitlements.forAccount(account.id);
      if (hasFeature(ents, 'employeeFreeTextAudio')) {
        const viaNlu = await this.tryEmployeeNlu(
          account,
          employee,
          phone,
          trimmed,
        );
        if (viaNlu) return viaNlu;
      }
    }

    if (step === 'emp:start') {
      return this.mainMenu(account, employee, phone);
    }

    if (step === 'emp:awaiting_agenda_date') {
      if (trimmed === 'day:custom' || /^outra\s+data$/i.test(trimmed)) {
        return {
          replies: ['Manda a data em dd/mm (ex.: 25/07).'],
        };
      }
      const date = this.parseDateInput(trimmed, account);
      if (!date) {
        return {
          replies: [
            'Manda a data no formato dd/mm (ex.: 25/07) ou toque em Hoje / Amanhã.',
          ],
          unresolved: true,
        };
      }
      return this.showAgenda(account, employee, phone, date);
    }

    if (step === 'emp:awaiting_menu_action') {
      // "cancelar" no menu = cancelar horário (não resetar sessão)
      if (lower === 'cancelar') {
        return this.startCancel(account, employee, phone);
      }
      if (/\b(concluir|conclu[ií]do|finalizar)\b/.test(lower)) {
        return this.startComplete(account, employee, phone);
      }
      if (
        trimmed === 'emp:human' ||
        /\b(falar\s+com\s+(humano|atendente|algu[eé]m)|atendimento\s+humano)\b/.test(
          lower,
        )
      ) {
        return this.requestHuman(account, employee, phone);
      }
      return this.handleMainAction(account, employee, phone, trimmed);
    }

    if (step === 'emp:awaiting_create_kind') {
      if (
        trimmed === 'emp:book' ||
        /\b(agendamento|cliente|servi[cç]o|marcar)\b/.test(lower)
      ) {
        const entsBook = await this.entitlements.forAccount(account.id);
        if (!hasFeature(entsBook, 'employeeWhatsappBookBlock')) {
          return {
            replies: [
              botCopy.employeeActionUnavailableOnWhatsapp(),
            ],
          };
        }
        return this.startBooking(account, employee, phone);
      }
      if (
        trimmed === 'emp:event' ||
        /\b(evento|bloqueio|bloquear|almo[cç]o|m[eé]dico|reuni[aã]o)\b/.test(
          lower,
        )
      ) {
        const entsEvent = await this.entitlements.forAccount(account.id);
        if (!hasFeature(entsEvent, 'employeeWhatsappBookBlock')) {
          return {
            replies: [
              botCopy.employeeActionUnavailableOnWhatsapp(),
            ],
          };
        }
        return this.startEvent(account, employee, phone);
      }
      return this.menuReply(
        'O que você quer criar?',
        CREATE_KIND_CHOICES,
        { listButton: 'Tipo' },
      );
    }

    if (step === 'emp:awaiting_service') {
      return this.handleServicePick(account, employee, phone, trimmed, data);
    }

    if (step === 'emp:awaiting_day') {
      return this.handleDayPick(account, employee, phone, trimmed, data);
    }

    if (step === 'emp:awaiting_custom_date') {
      const date = this.parseDateInput(trimmed, account);
      if (!date) {
        return {
          replies: ['Data inválida. Use dd/mm (ex.: 28/07).'],
          unresolved: true,
        };
      }
      return this.timeMenu(account, employee, phone, { ...data, date });
    }

    if (step === 'emp:awaiting_time') {
      return this.handleTimePick(account, employee, phone, trimmed, data);
    }

    if (step === 'emp:awaiting_custom_time') {
      const time = this.parseTimeInput(trimmed);
      if (!time) {
        return {
          replies: ['Horário inválido. Use hh:mm (ex.: 14:30).'],
          unresolved: true,
        };
      }
      return this.afterTimeChosen(account, employee, phone, {
        ...data,
        time,
      });
    }

    if (step === 'emp:awaiting_client_name') {
      const name = trimmed.replace(/\s+/g, ' ');
      if (name.length < 2) {
        return { replies: ['Qual o nome do cliente?'] };
      }
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_client_phone',
        data: { ...data, clientName: name },
      });
      return {
        replies: [
          `Telefone do(a) ${name}? (DDD + número, só dígitos — ou “pular” se não tiver)`,
        ],
      };
    }

    if (step === 'emp:awaiting_client_phone') {
      if (/^pular$/i.test(trimmed) || trimmed === '-') {
        return this.confirmBooking(account, employee, phone, {
          ...data,
          clientPhone: '',
        });
      }
      const clientPhone = normalizePhone(trimmed);
      if (clientPhone.length < 10) {
        return {
          replies: [
            'Telefone inválido. Manda com DDD (ex.: 11999998888) ou “pular”.',
          ],
          unresolved: true,
        };
      }
      return this.confirmBooking(account, employee, phone, {
        ...data,
        clientPhone,
      });
    }

    if (step === 'emp:awaiting_event_title') {
      const title = trimmed.replace(/\s+/g, ' ').slice(0, 80);
      if (title.length < 2) {
        return { replies: ['Qual o título do evento? (ex.: Almoço, Médico)'] };
      }
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_event_duration',
        data: { ...data, kind: 'block', title },
      });
      return this.menuReply('Quanto tempo dura?', DURATION_CHOICES, {
        listButton: 'Duração',
      });
    }

    if (step === 'emp:awaiting_event_duration') {
      const byId = /^dur:(\d+)$/.exec(trimmed);
      const byNum = this.parseChoice(trimmed, 4);
      const map = [30, 60, 90, 120];
      let duration = byId ? Number(byId[1]) : null;
      if (duration == null && byNum !== null) duration = map[byNum];
      if (!duration || duration < 15 || duration > 480) {
        return {
          replies: ['Escolha 30 min, 1h, 1h30 ou 2h.'],
          unresolved: true,
        };
      }
      return this.dayMenu(account, employee, phone, {
        ...data,
        kind: 'block',
        durationMinutes: duration,
      });
    }

    if (step === 'emp:awaiting_confirmation') {
      if (AFFIRMATIVE.includes(lower)) {
        return this.commitAppointment(account, employee, phone, data);
      }
      if (NEGATIVE.includes(lower)) {
        await this.resetSession(account.id, phone);
        return this.mainMenu(
          account,
          employee,
          phone,
          botCopy.employeeDiscardedDraft(),
        );
      }
      return this.confirmMenu('Confirma com Sim ou Não?');
    }

    if (step === 'emp:awaiting_cancel_pick') {
      const idMatch = /^appt:(.+)$/.exec(trimmed);
      const list = await this.listFutureForEmployee(account.id, employee.id);
      const byNum = this.parseChoice(trimmed, list.length);
      const appt =
        (idMatch && list.find((a) => a.id === idMatch[1])) ||
        (byNum !== null ? list[byNum] : null);
      if (!appt) {
        return {
          replies: ['Não achei esse horário. Escolha na lista.'],
          unresolved: true,
        };
      }
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_cancel_confirm',
        data: { ...data, cancelAppointmentId: appt.id },
      });
      return this.confirmMenu(
        `Cancelar ${this.formatApptLine(appt)}?`,
      );
    }

    if (step === 'emp:awaiting_cancel_confirm') {
      if (AFFIRMATIVE.includes(lower) && data.cancelAppointmentId) {
        const updated = await this.prisma.appointment.updateMany({
          where: {
            id: data.cancelAppointmentId,
            accountId: account.id,
            employeeId: employee.id,
            status: APPT_STATUS.SCHEDULED,
          },
          data: { status: APPT_STATUS.CANCELLED },
        });
        await this.resetSession(account.id, phone);
        if (updated.count === 0) {
          return this.mainMenu(
            account,
            employee,
            phone,
            'Esse horário já não estava ativo.',
          );
        }
        const appt = await this.prisma.appointment.findUnique({
          where: { id: data.cancelAppointmentId },
        });
        if (appt) {
          this.realtime.broadcast(account.id, 'appointment:updated', {
            appointment: serializeDates(appt),
          });
        }
        return this.mainMenu(
          account,
          employee,
          phone,
          'Horário cancelado. Mais alguma coisa?',
        );
      }
      if (NEGATIVE.includes(lower)) {
        await this.resetSession(account.id, phone);
        return this.mainMenu(account, employee, phone, botCopy.employeeKeptAppointment());
      }
      return this.confirmMenu('Confirma o cancelamento? Sim ou Não.');
    }

    if (step === 'emp:awaiting_complete_pick') {
      const idMatch = /^appt:(.+)$/.exec(trimmed);
      const list = await this.listCompletableForEmployee(
        account,
        employee.id,
      );
      const byNum = this.parseChoice(trimmed, list.length);
      const appt =
        (idMatch && list.find((a) => a.id === idMatch[1])) ||
        (byNum !== null ? list[byNum] : null);
      if (!appt) {
        return {
          replies: ['Não achei esse horário. Escolha na lista.'],
          unresolved: true,
        };
      }
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_complete_confirm',
        data: { ...data, cancelAppointmentId: appt.id },
      });
      return this.confirmMenu(
        `Marcar como concluído: ${this.formatApptLine(appt)}? O restante do horário fica livre na agenda.`,
      );
    }

    if (step === 'emp:awaiting_complete_confirm') {
      if (AFFIRMATIVE.includes(lower) && data.cancelAppointmentId) {
        const existing = await this.prisma.appointment.findFirst({
          where: {
            id: data.cancelAppointmentId,
            accountId: account.id,
            employeeId: employee.id,
          },
          include: { service: { select: { duration: true } } },
        });
        await this.resetSession(account.id, phone);
        if (!existing) {
          return this.mainMenu(
            account,
            employee,
            phone,
            'Esse horário já não estava ativo.',
          );
        }
        const check = canCompleteAppointment({
          status: existing.status,
          date: existing.date,
          time: existing.time,
          durationMinutes: appointmentDurationMinutes(existing),
          timezone: account.timezone,
          actor: 'employee',
        });
        if (!check.ok) {
          return this.mainMenu(account, employee, phone, check.error);
        }
        const appt = await this.prisma.appointment.update({
          where: { id: existing.id },
          data: {
            status: APPT_STATUS.COMPLETED,
            completedAt: new Date(),
          },
        });
        this.realtime.broadcast(account.id, 'appointment:updated', {
          appointment: serializeDates(appt),
        });
        return this.mainMenu(
          account,
          employee,
          phone,
          botCopy.employeeCompleted(),
        );
      }
      if (NEGATIVE.includes(lower)) {
        await this.resetSession(account.id, phone);
        return this.mainMenu(
          account,
          employee,
          phone,
          botCopy.employeeKeptScheduled(),
        );
      }
      return this.confirmMenu('Confirma a conclusão? Sim ou Não.');
    }

    await this.resetSession(account.id, phone);
    return this.mainMenu(account, employee, phone);
  }

  /** Texto livre (áudio/digitado), não id de botão/lista. */
  private looksLikeFreeText(text: string) {
    const t = text.trim();
    if (!t) return false;
    if (/^(emp:|day:|svc:|time:|dur:|appt:|sim|nao|não)$/i.test(t)) {
      return false;
    }
    if (/^(hoje|amanh[aã]|outra\s+data)$/i.test(t)) return false;
    return t.split(/\s+/).filter(Boolean).length >= 2 || t.length >= 8;
  }

  private shouldTryEmployeeNlu(step: string, text: string) {
    if (!this.looksLikeFreeText(text)) return false;
    if (
      step === 'emp:awaiting_confirmation' ||
      step === 'emp:awaiting_cancel_confirm' ||
      step === 'emp:awaiting_complete_confirm' ||
      step === 'emp:awaiting_custom_time' ||
      step === 'emp:awaiting_client_phone'
    ) {
      return false;
    }
    if (step === 'emp:start' || step === 'emp:awaiting_menu_action') {
      return true;
    }
    // Interrompe fluxo guiado se parecer comando novo (típico de áudio).
    return (
      /\b(agenda|marcar|agendar|cancelar|desmarcar|concluir|finalizar|humano|atendente|evento|bloquear|mostra|ver\s+(a\s+)?minha|me\s+fala|me\s+mostra|senha|redefinir)\b/i.test(
        text,
      ) || text.trim().split(/\s+/).filter(Boolean).length >= 6
    );
  }

  private async tryEmployeeNlu(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    text: string,
  ): Promise<WhatsappBotResult | null> {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return null;

    const apiKey = (this.config.get<string>('whatsapp.openaiApiKey') || '').trim();
    const services = employee.services.map((l) => l.service);

    // Frases completas (áudio) → LLM primeiro; heurística só como fallback.
    let parsed: Awaited<ReturnType<typeof this.extractEmployeeIntent>> = null;
    if (apiKey && words.length >= 3) {
      parsed = await this.extractEmployeeIntent(text, services, account);
    }

    const heuristic = this.heuristicEmployeeIntent(text, account);
    if (!parsed || parsed.intent === 'other') {
      if (!heuristic) return null;
      parsed = heuristic;
    } else if (heuristic) {
      // Completa lacunas do LLM com heurística (datas faladas, nome, hora).
      parsed = {
        ...parsed,
        date: parsed.date || heuristic.date,
        time: parsed.time || heuristic.time,
        clientName: parsed.clientName || heuristic.clientName,
        title: parsed.title || heuristic.title,
      };
    }

    // Datas faladas no texto têm prioridade (ex.: "28 do 7", "terça que vem").
    const spokenDate = this.parseRelativeDatePt(text, account);
    if (spokenDate) parsed.date = spokenDate;
    const spokenTime = this.parseTimeFromFreeText(text);
    if (spokenTime) parsed.time = spokenTime;
    const spokenClient = this.extractClientNameHeuristic(text);
    if (spokenClient && !parsed.clientName) parsed.clientName = spokenClient;

    console.log(
      `[whatsapp] NLU emp: ${JSON.stringify({
        intent: parsed.intent,
        date: parsed.date,
        time: parsed.time,
        clientName: parsed.clientName,
        serviceId: parsed.serviceId,
      })}`,
    );

    if (parsed.intent === 'agenda') {
      const date =
        parsed.date || this.localDateStr(this.nowInAccount(account));
      return this.showAgenda(account, employee, phone, date);
    }
    if (parsed.intent === 'cancel') {
      return this.startCancel(account, employee, phone, {
        clientName: parsed.clientName,
        date: parsed.date,
        time: parsed.time,
      });
    }
    if (parsed.intent === 'complete') {
      return this.startComplete(account, employee, phone, {
        clientName: parsed.clientName,
        date: parsed.date,
        time: parsed.time,
      });
    }
    if (parsed.intent === 'human') {
      return this.requestHuman(account, employee, phone);
    }
    if (parsed.intent === 'reset_password') {
      return this.sendPasswordReset(account, employee, phone);
    }
    if (parsed.intent === 'event') {
      if (parsed.title) {
        await this.saveSession(account.id, phone, {
          step: 'emp:awaiting_event_duration',
          data: {
            role: 'employee',
            employeeId: employee.id,
            kind: 'block',
            title: parsed.title,
          },
        });
        return this.menuReply(
          `Evento “${parsed.title}”. Quanto tempo dura?`,
          DURATION_CHOICES,
          { listButton: 'Duração' },
        );
      }
      return this.startEvent(account, employee, phone);
    }
    if (parsed.intent === 'book') {
      const service =
        (parsed.serviceId &&
          services.find((s) => s.id === parsed.serviceId)) ||
        this.matchServiceByName(services, text);
      if (!service) {
        return this.startBooking(account, employee, phone);
      }
      const data: EmpSessionData = {
        role: 'employee',
        employeeId: employee.id,
        kind: 'service',
        serviceId: service.id,
        date: parsed.date,
        time: parsed.time,
        clientName: parsed.clientName,
      };
      if (parsed.date && parsed.time) {
        return this.afterTimeChosen(account, employee, phone, data);
      }
      if (parsed.date) {
        return this.timeMenu(account, employee, phone, data);
      }
      return this.dayMenu(account, employee, phone, data);
    }
    return null;
  }

  private matchServiceByName(
    services: Array<{ id: string; name: string }>,
    text: string,
  ) {
    const lower = text.toLowerCase();
    const scored = services
      .map((s) => {
        const name = s.name.toLowerCase();
        if (lower.includes(name)) return { s, score: name.length };
        const tokens = name.split(/\s+/).filter((t) => t.length >= 3);
        const hit = tokens.some((t) => lower.includes(t));
        return hit ? { s, score: Math.max(...tokens.map((t) => t.length)) } : null;
      })
      .filter(Boolean) as Array<{ s: { id: string; name: string }; score: number }>;
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.s || null;
  }

  private heuristicEmployeeIntent(
    text: string,
    account: Account,
  ): {
    intent:
      | 'agenda'
      | 'book'
      | 'event'
      | 'cancel'
      | 'complete'
      | 'human'
      | 'reset_password'
      | 'other';
    serviceId?: string;
    date?: string;
    time?: string;
    title?: string;
    clientName?: string;
  } | null {
    const lower = text.toLowerCase();
    const relativeDate = this.parseRelativeDatePt(text, account);
    const time = this.parseTimeFromFreeText(text);
    const clientName = this.extractClientNameHeuristic(text);

    if (
      /\b(redefinir\s+senha|esqueci\s+(a\s+)?senha|trocar\s+senha|nova\s+senha|reset(ar)?\s+senha)\b/.test(
        lower,
      )
    ) {
      return { intent: 'reset_password' };
    }
    if (HUMAN_REQUEST_RE.test(text) || /\b(falar\s+com\s+humano|ajuda\s+humana)\b/.test(lower)) {
      return { intent: 'human' };
    }
    if (/\b(cancelar|desmarcar|cancela)\b/.test(lower)) {
      return {
        intent: 'cancel',
        date: relativeDate || undefined,
        time: time || undefined,
        clientName: clientName || undefined,
      };
    }
    if (
      /\b(concluir|conclu[ií]do|finalizar|terminei|já\s+terminei|ja\s+terminei)\b/.test(
        lower,
      )
    ) {
      return {
        intent: 'complete',
        date: relativeDate || undefined,
        time: time || undefined,
        clientName: clientName || undefined,
      };
    }
    if (/\b(evento|bloquear|bloqueio|almo[cç]o)\b/.test(lower)) {
      return { intent: 'event' };
    }

    if (
      /\b(agenda|hor[aá]rios?|o\s+que\s+tenho|meus?\s+hor[aá]rios?|me\s+(fala|mostra))\b/.test(
        lower,
      )
    ) {
      return {
        intent: 'agenda',
        date:
          relativeDate || this.localDateStr(this.nowInAccount(account)),
      };
    }

    if (/\b(agendar|marcar|novo\s+agendamento)\b/.test(lower)) {
      return {
        intent: 'book',
        date: relativeDate || undefined,
        time: time || undefined,
        clientName: clientName || undefined,
      };
    }
    return null;
  }

  private extractClientNameHeuristic(text: string): string | null {
    const patterns = [
      /\b(?:cliente)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3})/i,
      /\b(?:para|pra|pro|com|da|do)\s+(?:a|o)?\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,3})/i,
    ];
    for (const re of patterns) {
      const m = re.exec(text);
      if (!m) continue;
      let name = m[1].replace(/\s+/g, ' ').trim();
      // Corta em marcadores de data/hora que às vezes grudam no match.
      name = name
        .split(
          /\s+(?:para|pra|pro|amanh|hoje|às|as|no|na|dia|seg|ter|qua|qui|sex|s[aá]b|dom)\b/i,
        )[0]
        .trim();
      if (name.length < 2) continue;
      if (
        /^(o|a|um|uma|hoje|amanh[aã]|dia|horario|horário|cliente|agenda|corte)$/i.test(
          name,
        )
      ) {
        continue;
      }
      return name;
    }
    return null;
  }

  private parseTimeFromFreeText(text: string): string | null {
    const lower = text.toLowerCase();
    if (/\bmeio[\s-]?dia\b/.test(lower)) return '12:00';

    const patterns = [
      /\b(?:às|as)\s*(\d{1,2})[:h\.]?(\d{2})?\s*(?:h|hrs?|horas?)?\b/,
      /\b(\d{1,2})\s*h\s*(\d{2})\b/,
      /\b(\d{1,2}):(\d{2})\b/,
      /\b(\d{1,2})\s*h(?:oras?)?\b/,
    ];
    for (const re of patterns) {
      const m = re.exec(lower);
      if (!m) continue;
      let hh = Number(m[1]);
      const mm = m[2] ? Number(m[2]) : 0;
      if (/\bda\s+tarde\b/.test(lower) && hh > 0 && hh < 12) hh += 12;
      if (/\bda\s+manh[aã]\b/.test(lower) && hh === 12) hh = 0;
      if (hh > 23 || mm > 59) continue;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
    return null;
  }

  /** Resolve "terça que vem", "sexta-feira", "28 do 7", "28 de julho", "amanhã". */
  private parseRelativeDatePt(text: string, account: Account): string | null {
    const lower = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const base = this.nowInAccount(account);

    if (/\bhoje\b/.test(lower)) return this.localDateStr(base);
    if (/\bamanha\b/.test(lower)) {
      const d = new Date(base);
      d.setDate(d.getDate() + 1);
      return this.localDateStr(d);
    }

    const spoken = this.parseSpokenDayMonth(lower, base);
    if (spoken) return spoken;

    const dm = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/.exec(lower);
    if (dm) {
      return this.buildFutureDate(base, Number(dm[1]), Number(dm[2]));
    }

    const days: Array<{ re: RegExp; dow: number }> = [
      { re: /\bdomingo\b/, dow: 0 },
      { re: /\bsegunda(?:[\s-]?feira)?\b/, dow: 1 },
      { re: /\bterca(?:[\s-]?feira)?\b/, dow: 2 },
      { re: /\bquarta(?:[\s-]?feira)?\b/, dow: 3 },
      { re: /\bquinta(?:[\s-]?feira)?\b/, dow: 4 },
      { re: /\bsexta(?:[\s-]?feira)?\b/, dow: 5 },
      { re: /\bsabado\b/, dow: 6 },
    ];
    for (const day of days) {
      if (!day.re.test(lower)) continue;
      const forceNextWeek =
        /\b(que\s+vem|proxima|proximo|seguinte)\b/.test(lower) ||
        /\b(semana\s+que\s+vem)\b/.test(lower);
      return this.localDateStr(
        this.nextWeekday(base, day.dow, forceNextWeek),
      );
    }
    return null;
  }

  /** "28 do 7", "28 de julho", "dia 28 do setimo", "28 do sétimo". */
  private parseSpokenDayMonth(lowerNorm: string, base: Date): string | null {
    const byToken: Record<string, number> = {
      janeiro: 1,
      fevereiro: 2,
      marco: 3,
      abril: 4,
      maio: 5,
      junho: 6,
      julho: 7,
      setimo: 7,
      agosto: 8,
      oitavo: 8,
      setembro: 9,
      nono: 9,
      outubro: 10,
      decimo: 10,
      novembro: 11,
      dezembro: 12,
    };

    // "28 do 7" / "28 de 7" / "dia 28 do 7"
    const num = /(?:\bdia\s+)?(\d{1,2})\s+(?:do|de)\s+(\d{1,2})\b/.exec(
      lowerNorm,
    );
    if (num) {
      return this.buildFutureDate(base, Number(num[1]), Number(num[2]));
    }

    // "28 de julho" / "28 do setimo" / "dia 28 de setembro"
    const named =
      /(?:\bdia\s+)?(\d{1,2})\s+(?:do|de)\s+([a-z]+)\b/.exec(lowerNorm);
    if (named) {
      const month = byToken[named[2]];
      if (month) return this.buildFutureDate(base, Number(named[1]), month);
    }
    return null;
  }

  private buildFutureDate(base: Date, day: number, month: number) {
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    let year = base.getFullYear();
    let d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    if (d < today) {
      year += 1;
      d = new Date(year, month - 1, day);
    }
    return this.localDateStr(d);
  }

  private nextWeekday(from: Date, targetDow: number, forceNextWeek: boolean) {
    const d = new Date(from);
    d.setHours(12, 0, 0, 0);
    const current = d.getDay();
    let delta = (targetDow - current + 7) % 7;
    if (forceNextWeek) {
      // "terça que vem": se hoje ainda não é essa weekday, a próxima
      // ocorrência já é "que vem"; se hoje É essa weekday, +7.
      if (delta === 0) delta = 7;
    } else if (delta === 0) {
      // "sexta" sem qualificador no mesmo dia = hoje
      delta = 0;
    }
    d.setDate(d.getDate() + delta);
    return d;
  }

  private async extractEmployeeIntent(
    text: string,
    services: Array<{ id: string; name: string }>,
    account: Account,
  ): Promise<{
    intent:
      | 'agenda'
      | 'book'
      | 'event'
      | 'cancel'
      | 'complete'
      | 'human'
      | 'reset_password'
      | 'other';
    serviceId?: string;
    date?: string;
    time?: string;
    title?: string;
    clientName?: string;
  } | null> {
    const apiKey = (this.config.get<string>('whatsapp.openaiApiKey') || '').trim();
    if (!apiKey) return null;
    const now = this.nowInAccount(account);
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = this.localDateStr(now);
    const weekday = [
      'domingo',
      'segunda-feira',
      'terça-feira',
      'quarta-feira',
      'quinta-feira',
      'sexta-feira',
      'sábado',
    ][now.getDay()];
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const serviceList = services
      .map((s) => `- id: ${s.id} | nome: ${s.name}`)
      .join('\n');
    const system = [
      'Você extrai a intenção de um PROFISSIONAL de um negócio falando no WhatsApp (PT-BR).',
      `Hoje é ${weekday}, ${today}, agora são ${nowTime}.`,
      'Serviços que esse profissional realiza:',
      serviceList || '(nenhum)',
      '',
      'Responda SOMENTE JSON:',
      '- intent: "agenda" (ver a própria agenda), "book" (marcar serviço para um cliente), "event" (bloquear agenda / almoço), "cancel" (cancelar horário de cliente), "complete" (marcar atendimento como concluído — só na janela do horário), "human" (falar com a conta / atendente humano), "reset_password" (redefinir senha de acesso à Sof) ou "other"',
      '- serviceId: id do serviço mais próximo do que foi dito, ou null',
      '- date: YYYY-MM-DD ou null — resolva "hoje", "amanhã", "sexta", "terça que vem", "semana que vem", "28 do 7", "28 de julho", "28 do sétimo", "dia 28 de setembro"',
      '- time: HH:MM 24h ou null — "13h"/"13 horas"=13:00, "9h30"=09:30, "meio-dia"=12:00',
      '- clientName: nome do cliente se citado (ex.: "Ana Sousa", "Gabriela Dias"), senão null',
      '- title: título do evento se intent=event, senão null',
      '',
      'Preencha TODOS os campos que a frase trouxer. Não invente serviço fora da lista.',
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: text.slice(0, 500) },
          ],
        }),
      });
      if (!resp.ok) {
        console.error(
          `[whatsapp] NLU emp OpenAI falhou (${resp.status})`,
        );
        return null;
      }
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = JSON.parse(json.choices?.[0]?.message?.content || '{}') as {
        intent?: string;
        serviceId?: string | null;
        date?: string | null;
        time?: string | null;
        title?: string | null;
        clientName?: string | null;
      };
      const intent = String(raw.intent || 'other');
      if (
        ![
          'agenda',
          'book',
          'event',
          'cancel',
          'complete',
          'human',
          'reset_password',
        ].includes(intent)
      ) {
        return { intent: 'other' };
      }
      const serviceIds = new Set(services.map((s) => s.id));
      let date = String(raw.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        date = this.parseRelativeDatePt(text, account) || '';
      }
      let time = String(raw.time || '').trim();
      const tm = /^(\d{1,2}):(\d{2})$/.exec(time);
      if (tm) {
        const hh = Number(tm[1]);
        const min = Number(tm[2]);
        time =
          hh <= 23 && min <= 59
            ? `${String(hh).padStart(2, '0')}:${tm[2]}`
            : '';
      } else {
        time = this.parseTimeFromFreeText(text) || '';
      }
      const clientName = String(raw.clientName || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);

      return {
        intent: intent as
          | 'agenda'
          | 'book'
          | 'event'
          | 'cancel'
          | 'complete'
          | 'human'
          | 'reset_password',
        serviceId:
          raw.serviceId && serviceIds.has(raw.serviceId)
            ? raw.serviceId
            : undefined,
        date: date || undefined,
        time: time || undefined,
        title: raw.title || undefined,
        clientName: clientName.length >= 2 ? clientName : undefined,
      };
    } catch (err) {
      console.error(
        '[whatsapp] NLU emp erro:',
        err instanceof Error ? err.message : err,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async mainMenu(
    account: Account,
    employee: Employee,
    phone: string,
    intro?: string,
  ): Promise<WhatsappBotResult> {
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_menu_action',
      data: { role: 'employee', employeeId: employee.id },
    });
    const header =
      intro || botCopy.greetEmployee(employee.name, account.businessName);

    const completable = await this.listCompletableForEmployee(
      account,
      employee.id,
    );
    const choices: WhatsappMenuChoice[] = [];
    if (completable.length > 0) {
      choices.push({
        id: 'emp:complete',
        title: 'Concluir agendamento',
        description: 'Encerrar o atendimento atual',
      });
    }
    choices.push(
      {
        id: 'emp:agenda_today',
        title: 'Agenda de hoje',
        description: 'Ver seus horários de hoje',
      },
      {
        id: 'emp:agenda_other',
        title: 'Agenda de outro dia',
        description: 'Escolher outra data',
      },
      {
        id: 'emp:create',
        title: 'Novo na agenda',
        description: 'Agendamento ou evento',
      },
      {
        id: 'emp:cancel',
        title: 'Cancelar horário',
        description: 'Desmarcar um horário futuro',
      },
      {
        id: 'emp:human',
        title: 'Falar com estabelecimento',
        description: 'Pedir ajuda da conta do salão',
      },
      {
        id: 'emp:reset_password',
        title: 'Redefinir senha',
        description: 'Receber link no WhatsApp',
      },
    );

    return this.menuReply(header, choices, { listButton: 'Opções' });
  }

  private async handleMainAction(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    text: string,
  ): Promise<WhatsappBotResult> {
    const lower = text.toLowerCase();
    if (
      text === 'emp:agenda_today' ||
      /agenda\s+(de\s+)?hoje/i.test(lower) ||
      lower === 'hoje'
    ) {
      const today = this.localDateStr(this.nowInAccount(account));
      return this.showAgenda(account, employee, phone, today);
    }
    if (
      text === 'emp:agenda_other' ||
      /outro\s+dia|outra\s+data|agenda\s+de\s+outro/i.test(lower)
    ) {
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_agenda_date',
        data: { role: 'employee', employeeId: employee.id },
      });
      return this.menuReply('Qual dia da agenda?', DAY_CHOICES, {
        listButton: 'Dias',
      });
    }
    if (
      text === 'emp:create' ||
      /novo\s+na\s+agenda|criar\s+(na\s+)?agenda|nova\s+op[cç][aã]o/i.test(
        lower,
      )
    ) {
      const ents = await this.entitlements.forAccount(account.id);
      if (!hasFeature(ents, 'employeeWhatsappBookBlock')) {
        return {
          replies: [
            botCopy.employeeActionUnavailableOnWhatsapp(),
          ],
        };
      }
      return this.startCreate(account, employee, phone);
    }
    if (text === 'emp:book' || /novo\s+agendamento|marcar\s+(cliente|hor[aá]rio)/i.test(lower)) {
      const ents = await this.entitlements.forAccount(account.id);
      if (!hasFeature(ents, 'employeeWhatsappBookBlock')) {
        return {
          replies: [
            botCopy.employeeActionUnavailableOnWhatsapp(),
          ],
        };
      }
      return this.startBooking(account, employee, phone);
    }
    if (text === 'emp:event' || /novo\s+evento|bloquear|almo[cç]o/i.test(lower)) {
      const ents = await this.entitlements.forAccount(account.id);
      if (!hasFeature(ents, 'employeeWhatsappBookBlock')) {
        return {
          replies: [
            botCopy.employeeActionUnavailableOnWhatsapp(),
          ],
        };
      }
      return this.startEvent(account, employee, phone);
    }
    if (
      text === 'emp:reset_password' ||
      /\b(redefinir\s+senha|esqueci\s+(a\s+)?senha|trocar\s+senha|nova\s+senha)\b/i.test(
        lower,
      )
    ) {
      return this.sendPasswordReset(account, employee, phone);
    }
    if (text === 'emp:cancel' || /\bcancelar\b/.test(lower)) {
      return this.startCancel(account, employee, phone);
    }
    if (
      text === 'emp:complete' ||
      /\b(concluir|finalizar|marcar\s+como\s+conclu[ií]do)\b/.test(lower)
    ) {
      return this.startComplete(account, employee, phone);
    }
    if (
      text === 'emp:human' ||
      /\b(falar\s+com\s+(humano|atendente|algu[eé]m)|atendimento\s+humano)\b/.test(
        lower,
      )
    ) {
      return this.requestHuman(account, employee, phone);
    }

    // Atalhos de data no submenu de agenda
    if (text === 'day:today' || text === 'day:tomorrow' || text === 'day:custom') {
      return this.handleAgendaDayShortcut(account, employee, phone, text);
    }

    return {
      ...(await this.mainMenu(
        account,
        employee,
        phone,
        botCopy.employeeDidNotCatchMenu(),
      )),
      unresolved: true,
    };
  }

  private async requestHuman(
    account: Account,
    employee: Employee,
    phone: string,
  ): Promise<WhatsappBotResult> {
    await this.resetSession(account.id, phone);
    return {
      replies: [
        botCopy.employeeHandoff(employee.name),
      ],
      humanRequested: true,
    };
  }

  private async sendPasswordReset(
    account: Account,
    employee: Employee,
    phone: string,
  ): Promise<WhatsappBotResult> {
    try {
      await this.passwordReset.issueAndSendWhatsapp({
        employee,
        account,
        source: 'self',
      });
      await this.resetSession(account.id, phone);
      return this.mainMenu(
        account,
        employee,
        phone,
        'Pronto! Enviei o link para redefinir a senha neste WhatsApp. O link vale 2 horas. O que mais?',
      );
    } catch (err) {
      const msg =
        err instanceof BadRequestException
          ? String(
              (err.getResponse() as { error?: string })?.error ||
                err.message,
            )
          : err instanceof Error
            ? err.message
            : 'Não consegui enviar o link agora.';
      return this.mainMenu(
        account,
        employee,
        phone,
        `${msg} Peça ajuda ao responsável da conta se precisar.`,
      );
    }
  }

  private async handleAgendaDayShortcut(
    account: Account,
    employee: Employee,
    phone: string,
    text: string,
  ) {
    if (text === 'day:custom') {
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_agenda_date',
        data: { role: 'employee', employeeId: employee.id },
      });
      return { replies: ['Manda a data em dd/mm (ex.: 25/07).'] };
    }
    const base = this.nowInAccount(account);
    if (text === 'day:tomorrow') base.setDate(base.getDate() + 1);
    return this.showAgenda(account, employee, phone, this.localDateStr(base));
  }

  private async showAgenda(
    account: Account,
    employee: Employee,
    phone: string,
    date: string,
  ): Promise<WhatsappBotResult> {
    const rows = await this.prisma.appointment.findMany({
      where: {
        accountId: account.id,
        employeeId: employee.id,
        date,
        status: { in: [APPT_STATUS.SCHEDULED, APPT_STATUS.COMPLETED] },
      },
      orderBy: { time: 'asc' },
    });
    await this.resetSession(account.id, phone);
    const label = date.split('-').reverse().join('/');
    if (rows.length === 0) {
      return this.mainMenu(
        account,
        employee,
        phone,
        `Agenda de ${label}: livre. O que mais?`,
      );
    }
    const lines = rows
      .map((a) => {
        const mark =
          a.status === APPT_STATUS.COMPLETED ? ' (concluído)' : '';
        return `• ${this.formatApptLine(a)}${mark}`;
      })
      .join('\n');
    return this.mainMenu(
      account,
      employee,
      phone,
      `Agenda de ${label}:\n${lines}\n\nO que mais?`,
    );
  }

  private async startCreate(
    account: Account,
    employee: Employee,
    phone: string,
  ): Promise<WhatsappBotResult> {
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_create_kind',
      data: { role: 'employee', employeeId: employee.id },
    });
    return this.menuReply(
      'O que você quer criar?',
      CREATE_KIND_CHOICES,
      { listButton: 'Tipo' },
    );
  }

  private async startBooking(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
  ) {
    const services = employee.services.map((l) => l.service);
    if (services.length === 0) {
      return this.mainMenu(
        account,
        employee,
        phone,
        'Você ainda não tem serviços vinculados. Peça para a conta configurar na aba Profissionais.',
      );
    }
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_service',
      data: {
        role: 'employee',
        employeeId: employee.id,
        kind: 'service',
      },
    });
    return this.menuReply(
      'Qual serviço do cliente?',
      services.map((s) => ({
        id: `svc:${s.id}`,
        title: s.name,
        description: `${s.duration} min · R$ ${s.price}`,
      })),
      { listButton: 'Serviços' },
    );
  }

  private async startEvent(
    account: Account,
    employee: Employee,
    phone: string,
  ) {
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_event_title',
      data: {
        role: 'employee',
        employeeId: employee.id,
        kind: 'block',
      },
    });
    return {
      replies: ['Qual o título do evento? (ex.: Almoço, Médico, Reunião)'],
    };
  }

  private async startComplete(
    account: Account,
    employee: Employee,
    phone: string,
    filter?: { clientName?: string; date?: string; time?: string },
  ) {
    let list = await this.listCompletableForEmployee(account, employee.id);
    if (list.length === 0) {
      return this.mainMenu(
        account,
        employee,
        phone,
        'Nenhum atendimento em andamento agora. Só dá para concluir dentro da janela do horário.',
      );
    }

    if (filter?.date || filter?.time || filter?.clientName) {
      const nameNeedle = (filter.clientName || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const filtered = list.filter((a) => {
        if (filter.date && a.date !== filter.date) return false;
        if (filter.time && a.time !== filter.time) return false;
        if (nameNeedle) {
          const client = String(a.clientName || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          if (!client.includes(nameNeedle) && !nameNeedle.includes(client)) {
            const tokens = nameNeedle.split(/\s+/).filter((t) => t.length >= 3);
            if (!tokens.every((t) => client.includes(t))) return false;
          }
        }
        return true;
      });
      if (filtered.length === 1) {
        const appt = filtered[0];
        await this.saveSession(account.id, phone, {
          step: 'emp:awaiting_complete_confirm',
          data: {
            role: 'employee',
            employeeId: employee.id,
            cancelAppointmentId: appt.id,
          },
        });
        return this.confirmMenu(
          `Marcar como concluído: ${this.formatApptLine(appt)}? O restante do horário fica livre.`,
        );
      }
      if (filtered.length > 1) {
        list = filtered;
      } else if (filter.date || filter.time || filter.clientName) {
        return this.mainMenu(
          account,
          employee,
          phone,
          'Não achei um atendimento em andamento com esses dados.',
        );
      }
    }

    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_complete_pick',
      data: { role: 'employee', employeeId: employee.id },
    });
    return this.menuReply(
      'Qual agendamento concluir? (só os que estão na janela agora)',
      list.slice(0, 10).map((a) => ({
        id: `appt:${a.id}`,
        title: `${a.time} · ${a.date.split('-').reverse().join('/')}`,
        description: this.formatApptLine(a),
      })),
      { listButton: 'Agendamentos' },
    );
  }

  private async startCancel(
    account: Account,
    employee: Employee,
    phone: string,
    filter?: { clientName?: string; date?: string; time?: string },
  ) {
    let list = await this.listFutureForEmployee(account.id, employee.id);
    if (list.length === 0) {
      return this.mainMenu(
        account,
        employee,
        phone,
        'Você não tem horários futuros para cancelar.',
      );
    }

    if (filter?.date || filter?.time || filter?.clientName) {
      const nameNeedle = (filter.clientName || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const filtered = list.filter((a) => {
        if (filter.date && a.date !== filter.date) return false;
        if (filter.time && a.time !== filter.time) return false;
        if (nameNeedle) {
          const client = String(a.clientName || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
          if (!client.includes(nameNeedle) && !nameNeedle.includes(client)) {
            // match parcial por primeiro+último token
            const tokens = nameNeedle.split(/\s+/).filter((t) => t.length >= 3);
            if (!tokens.every((t) => client.includes(t))) return false;
          }
        }
        return true;
      });
      if (filtered.length === 1) {
        const appt = filtered[0];
        await this.saveSession(account.id, phone, {
          step: 'emp:awaiting_cancel_confirm',
          data: {
            role: 'employee',
            employeeId: employee.id,
            cancelAppointmentId: appt.id,
          },
        });
        return this.confirmMenu(`Cancelar ${this.formatApptLine(appt)}?`);
      }
      if (filtered.length > 1) {
        list = filtered;
      } else if (filter.date || filter.time || filter.clientName) {
        return this.mainMenu(
          account,
          employee,
          phone,
          'Não achei um horário com esses dados. Quer tentar de outro jeito?',
        );
      }
    }

    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_cancel_pick',
      data: { role: 'employee', employeeId: employee.id },
    });
    return this.menuReply(
      'Qual horário cancelar?',
      list.slice(0, 10).map((a) => ({
        id: `appt:${a.id}`,
        title: `${a.time} · ${a.date.split('-').reverse().join('/')}`,
        description: this.formatApptLine(a),
      })),
      { listButton: 'Horários' },
    );
  }

  private async handleServicePick(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    text: string,
    data: EmpSessionData,
  ) {
    const services = employee.services.map((l) => l.service);
    const idMatch = /^svc:(.+)$/.exec(text);
    const byNum = this.parseChoice(text, services.length);
    const service =
      (idMatch && services.find((s) => s.id === idMatch[1])) ||
      (byNum !== null ? services[byNum] : null) ||
      services.find((s) => s.name.toLowerCase() === text.toLowerCase());
    if (!service) {
      return {
        replies: ['Escolha um serviço da lista.'],
        unresolved: true,
      };
    }
    return this.dayMenu(account, employee, phone, {
      ...data,
      kind: 'service',
      serviceId: service.id,
    });
  }

  private async dayMenu(
    account: Account,
    employee: Employee,
    phone: string,
    data: EmpSessionData,
  ): Promise<WhatsappBotResult> {
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_day',
      data,
    });
    return this.menuReply('Qual dia?', DAY_CHOICES, { listButton: 'Dias' });
  }

  private async handleDayPick(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    text: string,
    data: EmpSessionData,
  ) {
    if (text === 'day:custom' || /^outra\s+data$/i.test(text)) {
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_custom_date',
        data,
      });
      return { replies: ['Manda a data em dd/mm.'] };
    }
    const base = this.nowInAccount(account);
    if (text === 'day:tomorrow' || /^amanh[aã]$/i.test(text)) {
      base.setDate(base.getDate() + 1);
    } else if (!(text === 'day:today' || /^hoje$/i.test(text))) {
      const parsed = this.parseDateInput(text, account);
      if (!parsed) {
        return {
          replies: ['Escolha Hoje, Amanhã ou Outra data.'],
          unresolved: true,
        };
      }
      return this.timeMenu(account, employee, phone, { ...data, date: parsed });
    }
    return this.timeMenu(account, employee, phone, {
      ...data,
      date: this.localDateStr(base),
    });
  }

  private async timeMenu(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    data: EmpSessionData,
    opts?: { intro?: string },
  ): Promise<WhatsappBotResult> {
    const date = data.date!;
    const duration =
      data.kind === 'block'
        ? data.durationMinutes || 60
        : employee.services.find((l) => l.service.id === data.serviceId)?.service
            .duration || 30;
    const slots = await this.findFreeSlots(
      account,
      employee.id,
      date,
      duration,
    );
    if (slots.length === 0) {
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_day',
        data,
      });
      return this.menuReply(
        `Sem horários livres em ${date.split('-').reverse().join('/')}. Escolha outro dia:`,
        DAY_CHOICES,
        { listButton: 'Dias' },
      );
    }
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_time',
      data,
    });
    const choices: WhatsappMenuChoice[] = slots.slice(0, 5).map((t) => ({
      id: `time:${t}`,
      title: t,
      description: 'Horário livre neste dia',
    }));
    choices.push({
      id: 'time:custom',
      title: 'Outro horário',
      description: 'Informar a hora em hh:mm',
    });
    return this.menuReply(
      opts?.intro ||
        `Horários livres em ${date.split('-').reverse().join('/')}:`,
      choices,
      { listButton: 'Horários' },
    );
  }

  private async handleTimePick(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    text: string,
    data: EmpSessionData,
  ) {
    if (CUSTOM_TIME_RE.test(text) || text === 'time:custom') {
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_custom_time',
        data,
      });
      return { replies: ['Qual horário? (hh:mm)'] };
    }
    const idMatch = TIME_ID_RE.exec(text);
    const time = idMatch?.[1] || this.parseTimeInput(text);
    if (!time) {
      return {
        replies: ['Escolha um horário da lista ou digite hh:mm.'],
        unresolved: true,
      };
    }
    return this.afterTimeChosen(account, employee, phone, { ...data, time });
  }

  private async afterTimeChosen(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    data: EmpSessionData,
  ): Promise<WhatsappBotResult> {
    const duration =
      data.kind === 'block'
        ? data.durationMinutes || 60
        : employee.services.find((l) => l.service.id === data.serviceId)?.service
            .duration || 30;

    const hoursCheck = checkWithinOpeningHours(
      account.openingHours,
      data.date!,
      data.time!,
      duration,
    );
    if (!hoursCheck.ok) {
      await this.saveSession(account.id, phone, {
        step: 'emp:awaiting_day',
        data,
      });
      return this.menuReply(
        'Fora do expediente ou dia fechado. Escolha outro dia:',
        DAY_CHOICES,
        { listButton: 'Dias' },
      );
    }

    const busy = await listBusySlots(this.prisma, {
      accountId: account.id,
      employeeId: employee.id,
      date: data.date!,
    });
    if (hasScheduleConflict(busy, data.time!, duration)) {
      return this.timeMenu(account, employee, phone, data, {
        intro: 'Esse horário conflita com outro compromisso. Escolha outro:',
      });
    }

    if (data.kind === 'block') {
      return this.confirmBooking(account, employee, phone, data);
    }
    if (data.clientName && data.clientName.trim().length >= 2) {
      // Frase completa já trouxe o nome — tenta achar telefone no cadastro
      // e vai direto à confirmação (telefone opcional).
      const existing = await this.prisma.client.findFirst({
        where: {
          accountId: account.id,
          name: { equals: data.clientName.trim(), mode: 'insensitive' },
        },
      });
      return this.confirmBooking(account, employee, phone, {
        ...data,
        clientName: existing?.name || data.clientName.trim(),
        clientPhone: existing?.phone || data.clientPhone || '',
      });
    }
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_client_name',
      data,
    });
    return { replies: ['Nome do cliente?'] };
  }

  private async confirmBooking(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    data: EmpSessionData,
  ) {
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_confirmation',
      data,
    });
    const when = `${data.date!.split('-').reverse().join('/')} às ${data.time}`;
    if (data.kind === 'block') {
      return this.confirmMenu(
        `Bloquear “${data.title}” (${data.durationMinutes} min) em ${when}?`,
      );
    }
    const service = employee.services.find(
      (l) => l.service.id === data.serviceId,
    )?.service;
    return this.confirmMenu(
      `Marcar ${service?.name || 'serviço'} para ${data.clientName}${
        data.clientPhone ? ` (${data.clientPhone})` : ''
      } em ${when}?`,
    );
  }

  private async commitAppointment(
    account: Account,
    employee: Employee & {
      services: { service: { id: string; name: string; duration: number; price: number } }[];
    },
    phone: string,
    data: EmpSessionData,
  ): Promise<WhatsappBotResult> {
    const duration =
      data.kind === 'block'
        ? data.durationMinutes || 60
        : employee.services.find((l) => l.service.id === data.serviceId)?.service
            .duration || 30;

    const busy = await listBusySlots(this.prisma, {
      accountId: account.id,
      employeeId: employee.id,
      date: data.date!,
    });
    if (hasScheduleConflict(busy, data.time!, duration)) {
      await this.resetSession(account.id, phone);
      return this.mainMenu(
        account,
        employee,
        phone,
        'Alguém pegou esse horário no meio do caminho. Tente de novo.',
      );
    }

    let clientId: string | null = null;
    let clientName = data.clientName || '';
    let clientPhone = data.clientPhone || '';

    if (data.kind !== 'block') {
      const service = employee.services.find(
        (l) => l.service.id === data.serviceId,
      )?.service;
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.mainMenu(account, employee, phone, 'Serviço inválido.');
      }
      if (clientPhone) {
        const client = await this.prisma.client.upsert({
          where: {
            accountId_phone: { accountId: account.id, phone: clientPhone },
          },
          create: {
            accountId: account.id,
            name: clientName || `Cliente ${clientPhone.slice(-4)}`,
            phone: clientPhone,
          },
          update: clientName ? { name: clientName } : {},
        });
        clientId = client.id;
        clientName = client.name;
      }
      const appt = await this.prisma.appointment.create({
        data: {
          accountId: account.id,
          employeeId: employee.id,
          serviceId: service.id,
          clientId,
          kind: 'service',
          title: '',
          durationMinutes: null,
          clientName: clientName || 'Cliente',
          clientPhone: clientPhone || '',
          date: data.date!,
          time: data.time!,
          price: service.price,
          status: APPT_STATUS.SCHEDULED,
          source: 'whatsapp',
        },
      });
      this.realtime.broadcast(account.id, 'appointment:created', {
        appointment: serializeDates(appt),
      });
      await this.employeeBookingNotify.notifyNewServiceBookings({
        accountId: account.id,
        appointmentIds: [appt.id],
        skipEmployeeId: employee.id,
      });
      await this.resetSession(account.id, phone);
      return this.mainMenu(
        account,
        employee,
        phone,
        `Agendamento criado: ${service.name} em ${data.date!.split('-').reverse().join('/')} às ${data.time}.`,
      );
    }

    const appt = await this.prisma.appointment.create({
      data: {
        accountId: account.id,
        employeeId: employee.id,
        serviceId: null,
        clientId: null,
        kind: 'block',
        title: data.title || 'Bloqueio',
        durationMinutes: duration,
        clientName: '',
        clientPhone: '',
        date: data.date!,
        time: data.time!,
        price: 0,
        status: APPT_STATUS.SCHEDULED,
        source: 'whatsapp',
      },
    });
    this.realtime.broadcast(account.id, 'appointment:created', {
      appointment: serializeDates(appt),
    });
    await this.resetSession(account.id, phone);
    return this.mainMenu(
      account,
      employee,
      phone,
      `Evento “${data.title}” gravado em ${data.date!.split('-').reverse().join('/')} às ${data.time}.`,
    );
  }

  private async findFreeSlots(
    account: Account,
    employeeId: string,
    date: string,
    durationMinutes: number,
  ) {
    const hours = normalizeOpeningHours(account.openingHours);
    const day = new Date(`${date}T12:00:00`);
    const schedule = hours[day.getDay()];
    if (!schedule?.open) return [] as string[];

    const busy = await listBusySlots(this.prisma, {
      accountId: account.id,
      employeeId,
      date,
    });
    const startMin = timeToMinutes(schedule.start);
    const endMin = timeToMinutes(schedule.end);
    const slots: string[] = [];
    for (let t = startMin; t + durationMinutes <= endMin; t += 30) {
      const time = minutesToTime(t);
      if (!hasScheduleConflict(busy, time, durationMinutes)) {
        slots.push(time);
      }
    }
    return slots;
  }

  private async listFutureForEmployee(accountId: string, employeeId: string) {
    const today = this.localDateStr(new Date());
    return this.prisma.appointment.findMany({
      where: {
        accountId,
        employeeId,
        status: APPT_STATUS.SCHEDULED,
        OR: [
          { date: { gt: today } },
          { date: today, time: { gte: this.localTimeStr(new Date()) } },
        ],
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 15,
    });
  }

  /** Agendamentos do prof que ainda estão `scheduled` e dentro da janela [início, fim]. */
  private async listCompletableForEmployee(
    account: Account,
    employeeId: string,
  ) {
    const today = this.localDateStr(this.nowInAccount(account));
    const rows = await this.prisma.appointment.findMany({
      where: {
        accountId: account.id,
        employeeId,
        status: APPT_STATUS.SCHEDULED,
        date: { lte: today },
      },
      include: { service: { select: { duration: true } } },
      orderBy: [{ date: 'desc' }, { time: 'desc' }],
      take: 40,
    });
    return rows.filter((a) => {
      const check = canCompleteAppointment({
        status: a.status,
        date: a.date,
        time: a.time,
        durationMinutes: appointmentDurationMinutes(a),
        timezone: account.timezone,
        actor: 'employee',
      });
      return check.ok;
    });
  }

  private formatApptLine(a: {
    time: string;
    date: string;
    kind: string;
    title: string;
    clientName: string;
    serviceId: string | null;
  }) {
    const day = a.date.split('-').reverse().join('/');
    if (a.kind === 'block') {
      return `${a.time} ${day} · ${a.title || 'Evento'}`;
    }
    return `${a.time} ${day} · ${a.clientName || 'Cliente'}`;
  }

  private menuReply(
    text: string,
    choices: WhatsappMenuChoice[],
    opts?: { listButton?: string },
  ): WhatsappBotResult {
    const interactive: WhatsappInteractiveMenu = {
      text,
      choices,
      listButton: opts?.listButton,
    };
    return {
      replies: [text],
      interactive: [interactive],
    };
  }

  private confirmMenu(text: string): WhatsappBotResult {
    return this.menuReply(
      text,
      [
        { id: 'sim', title: 'Sim', description: 'Confirmar esta ação' },
        { id: 'nao', title: 'Não', description: 'Voltar sem confirmar' },
      ],
      { listButton: 'Confirmar' },
    );
  }

  private parseChoice(text: string, max: number) {
    const n = Number.parseInt(String(text).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > max) return null;
    return n - 1;
  }

  private parseDateInput(text: string, account: Account) {
    const lower = text.toLowerCase().trim();
    const base = this.nowInAccount(account);
    if (lower === 'hoje' || text === 'day:today') {
      return this.localDateStr(base);
    }
    if (lower === 'amanhã' || lower === 'amanha' || text === 'day:tomorrow') {
      base.setDate(base.getDate() + 1);
      return this.localDateStr(base);
    }
    const spoken = this.parseRelativeDatePt(text, account);
    if (spoken) return spoken;
    const m = DATE_ONLY_RE.exec(text.trim());
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    return this.buildFutureDate(this.nowInAccount(account), day, month);
  }

  private parseTimeInput(text: string) {
    const m = TIME_ONLY_RE.exec(text.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private nowInAccount(_account: Account) {
    return new Date();
  }

  private localDateStr(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private localTimeStr(date: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private async saveSession(
    accountId: string,
    customerPhone: string,
    opts: { step: string; data: EmpSessionData },
  ) {
    await this.prisma.whatsappSession.upsert({
      where: {
        accountId_customerPhone: { accountId, customerPhone },
      },
      create: {
        accountId,
        customerPhone,
        step: opts.step,
        data: opts.data as unknown as Prisma.InputJsonValue,
      },
      update: {
        step: opts.step,
        data: opts.data as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async resetSession(accountId: string, customerPhone: string) {
    await this.prisma.whatsappSession.deleteMany({
      where: { accountId, customerPhone },
    });
  }
}
