import { Injectable } from '@nestjs/common';
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
import type {
  WhatsappBotResult,
  WhatsappInteractiveMenu,
  WhatsappMenuChoice,
} from './whatsapp-bot.service';

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
const AFFIRMATIVE = ['sim', 's', 'confirmar', 'confirmo', 'ok', 'fecha', 'fechado'];
const NEGATIVE = ['não', 'nao', 'n', 'cancelar'];
const CUSTOM_TIME_RE = /^(outro|outra|custom|time:custom)$/i;
const TIME_ID_RE = /^time:(\d{2}:\d{2})$/;

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 10_000;

@Injectable()
export class WhatsappEmployeeBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
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

    if (lower === 'cancelar' || lower === '/reset' || lower === 'reset') {
      await this.resetSession(account.id, phone);
      return {
        replies: [
          `Pronto, ${employee.name}. Reiniciei o menu do profissional. Manda qualquer mensagem para ver as opções.`,
        ],
      };
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

    const viaNlu =
      step === 'emp:start'
        ? await this.tryEmployeeNlu(account, employee, phone, trimmed)
        : null;
    if (viaNlu) return viaNlu;

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
      return this.handleMainAction(account, employee, phone, trimmed);
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
      return this.menuReply('Quanto tempo dura?', [
        { id: 'dur:30', title: '30 min' },
        { id: 'dur:60', title: '1 hora' },
        { id: 'dur:90', title: '1h30' },
        { id: 'dur:120', title: '2 horas' },
      ]);
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
          'Ok, não gravei. O que você quer fazer?',
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
            status: 'confirmed',
          },
          data: { status: 'cancelled' },
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
        return this.mainMenu(account, employee, phone, 'Ok, mantive o horário.');
      }
      return this.confirmMenu('Confirma o cancelamento? Sim ou Não.');
    }

    await this.resetSession(account.id, phone);
    return this.mainMenu(account, employee, phone);
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
    if (words.length < 3) return null;
    const apiKey = (this.config.get<string>('whatsapp.openaiApiKey') || '').trim();
    if (!apiKey) return null;

    const services = employee.services.map((l) => l.service);
    const parsed = await this.extractEmployeeIntent(text, services);
    if (!parsed) return null;

    if (parsed.intent === 'agenda') {
      const date =
        parsed.date || this.localDateStr(this.nowInAccount(account));
      return this.showAgenda(account, employee, phone, date);
    }
    if (parsed.intent === 'cancel') {
      return this.startCancel(account, employee, phone);
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
          [
            { id: 'dur:30', title: '30 min' },
            { id: 'dur:60', title: '1 hora' },
            { id: 'dur:90', title: '1h30' },
            { id: 'dur:120', title: '2 horas' },
          ],
        );
      }
      return this.startEvent(account, employee, phone);
    }
    if (parsed.intent === 'book') {
      const service =
        (parsed.serviceId &&
          services.find((s) => s.id === parsed.serviceId)) ||
        null;
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

  private async extractEmployeeIntent(
    text: string,
    services: Array<{ id: string; name: string }>,
  ): Promise<{
    intent: 'agenda' | 'book' | 'event' | 'cancel' | 'other';
    serviceId?: string;
    date?: string;
    time?: string;
    title?: string;
  } | null> {
    const apiKey = (this.config.get<string>('whatsapp.openaiApiKey') || '').trim();
    if (!apiKey) return null;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const serviceList = services
      .map((s) => `- id: ${s.id} | nome: ${s.name}`)
      .join('\n');
    const system = [
      'Você extrai a intenção de um PROFISSIONAL de salão falando no WhatsApp (PT-BR).',
      `Hoje é ${today}.`,
      'Serviços que esse profissional realiza:',
      serviceList || '(nenhum)',
      '',
      'Responda SOMENTE JSON:',
      '- intent: "agenda" (ver horários do dia), "book" (marcar serviço para cliente), "event" (bloquear agenda / almoço / compromisso), "cancel" (cancelar horário) ou "other"',
      '- serviceId: id do serviço ou null',
      '- date: YYYY-MM-DD ou null',
      '- time: HH:MM ou null',
      '- title: título do evento se intent=event, senão null',
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
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = JSON.parse(json.choices?.[0]?.message?.content || '{}') as {
        intent?: string;
        serviceId?: string | null;
        date?: string | null;
        time?: string | null;
        title?: string | null;
      };
      const intent = String(raw.intent || 'other');
      if (!['agenda', 'book', 'event', 'cancel'].includes(intent)) {
        return { intent: 'other' };
      }
      const serviceIds = new Set(services.map((s) => s.id));
      return {
        intent: intent as 'agenda' | 'book' | 'event' | 'cancel',
        serviceId:
          raw.serviceId && serviceIds.has(raw.serviceId)
            ? raw.serviceId
            : undefined,
        date: raw.date || undefined,
        time: raw.time || undefined,
        title: raw.title || undefined,
      };
    } catch {
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
      intro ||
      `Oi, ${employee.name}! Aqui é a Sof — menu do profissional (${account.businessName}).`;
    return this.menuReply(header, [
      { id: 'emp:agenda_today', title: 'Agenda de hoje' },
      { id: 'emp:agenda_other', title: 'Agenda de outro dia' },
      { id: 'emp:book', title: 'Novo agendamento' },
      { id: 'emp:event', title: 'Novo evento' },
      { id: 'emp:cancel', title: 'Cancelar horário' },
    ], { listButton: 'Opções' });
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
      return this.menuReply('Qual dia da agenda?', [
        { id: 'day:today', title: 'Hoje' },
        { id: 'day:tomorrow', title: 'Amanhã' },
        { id: 'day:custom', title: 'Outra data' },
      ]);
    }
    if (text === 'emp:book' || /novo\s+agendamento|marcar\s+(cliente|hor[aá]rio)/i.test(lower)) {
      return this.startBooking(account, employee, phone);
    }
    if (text === 'emp:event' || /novo\s+evento|bloquear|almo[cç]o/i.test(lower)) {
      return this.startEvent(account, employee, phone);
    }
    if (text === 'emp:cancel' || /cancelar/.test(lower)) {
      return this.startCancel(account, employee, phone);
    }

    // Atalhos de data no submenu de agenda
    if (text === 'day:today' || text === 'day:tomorrow' || text === 'day:custom') {
      return this.handleAgendaDayShortcut(account, employee, phone, text);
    }

    return this.mainMenu(
      account,
      employee,
      phone,
      'Não entendi. Escolha uma opção do menu:',
    );
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
        status: 'confirmed',
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
    const lines = rows.map((a) => `• ${this.formatApptLine(a)}`).join('\n');
    return this.mainMenu(
      account,
      employee,
      phone,
      `Agenda de ${label}:\n${lines}\n\nO que mais?`,
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

  private async startCancel(
    account: Account,
    employee: Employee,
    phone: string,
  ) {
    const list = await this.listFutureForEmployee(account.id, employee.id);
    if (list.length === 0) {
      return this.mainMenu(
        account,
        employee,
        phone,
        'Você não tem horários futuros para cancelar.',
      );
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
    return this.menuReply('Qual dia?', [
      { id: 'day:today', title: 'Hoje' },
      { id: 'day:tomorrow', title: 'Amanhã' },
      { id: 'day:custom', title: 'Outra data' },
    ]);
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
        [
          { id: 'day:today', title: 'Hoje' },
          { id: 'day:tomorrow', title: 'Amanhã' },
          { id: 'day:custom', title: 'Outra data' },
        ],
      );
    }
    await this.saveSession(account.id, phone, {
      step: 'emp:awaiting_time',
      data,
    });
    const choices: WhatsappMenuChoice[] = slots.slice(0, 5).map((t) => ({
      id: `time:${t}`,
      title: t,
    }));
    choices.push({ id: 'time:custom', title: 'Outro horário' });
    return this.menuReply(
      opts?.intro ||
        `Horários livres em ${date.split('-').reverse().join('/')}:`,
      choices,
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
        [
          { id: 'day:today', title: 'Hoje' },
          { id: 'day:tomorrow', title: 'Amanhã' },
          { id: 'day:custom', title: 'Outra data' },
        ],
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
          status: 'confirmed',
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
        status: 'confirmed',
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
        status: 'confirmed',
        OR: [
          { date: { gt: today } },
          { date: today, time: { gte: this.localTimeStr(new Date()) } },
        ],
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 15,
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
    return this.menuReply(text, [
      { id: 'sim', title: 'Sim' },
      { id: 'nao', title: 'Não' },
    ]);
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
    const m = DATE_ONLY_RE.exec(text.trim());
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = base.getFullYear();
    const d = new Date(year, month - 1, day);
    if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
    if (d < new Date(base.getFullYear(), base.getMonth(), base.getDate())) {
      d.setFullYear(year + 1);
    }
    return this.localDateStr(d);
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
