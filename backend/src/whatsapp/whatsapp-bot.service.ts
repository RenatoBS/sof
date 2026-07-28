import { Injectable } from '@nestjs/common';
import { Account, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../events/realtime.service';
import { serializeDates } from '../common/public-shapes';
import { normalizePhone } from '../common/phone';
import {
  checkWithinOpeningHours,
  formatOpeningHoursSummary,
  getDaySchedule,
  normalizeOpeningHours,
} from '../account/opening-hours';
import {
  hasScheduleConflict,
  listBusySlots,
  minutesToTime,
  timeToMinutes,
} from '../appointments/schedule-conflict';
import { BookingNluService } from './booking-nlu.service';
import { WhatsappEmployeeBotService } from './whatsapp-employee-bot.service';
import { EmployeeBookingNotifyService } from './employee-booking-notify.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import {
  EntitlementsMap,
  hasFeature,
} from '../entitlements/feature-catalog';
import { formatReminderLeadLabel } from '../reminders/reminder-window';

type SessionData = {
  clientId?: string;
  clientName?: string;
  serviceId?: string;
  employeeId?: string;
  date?: string;
  time?: string;
  cancelAppointmentId?: string;
};

type SlotOption = { date: string; time: string };

export type WhatsappMenuChoice = {
  id: string;
  title: string;
  description?: string;
};

export type WhatsappInteractiveMenu = {
  text: string;
  choices: WhatsappMenuChoice[];
  listButton?: string;
  footerText?: string;
};

export type WhatsappBotResult = {
  replies: string[];
  interactive?: WhatsappInteractiveMenu[];
  appointment?: ReturnType<typeof serializeDates>;
  /** Entrada inválida / não entendida — conta para escalonamento. */
  unresolved?: boolean;
  /** Cliente pediu atendimento humano. */
  humanRequested?: boolean;
};

const DATETIME_RE = /(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/;
const DATE_ONLY_RE = /^(\d{1,2})[\/\-](\d{1,2})$/;
const TIME_ONLY_RE = /^(\d{1,2}):(\d{2})$/;
const AFFIRMATIVE = ['sim', 's', 'confirmar', 'confirmo', 'ok', 'fecha', 'fechado'];
const NEGATIVE = ['não', 'nao', 'n', 'cancelar'];
const CUSTOM_TIME_RE = /^(outro|outra|custom|time:custom|slot:custom)$/i;
const TIME_ID_RE = /^time:(\d{2}:\d{2})$/;
const SLOT_ID_RE = /^slot:(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/;
const ADDRESS_RE =
  /\b(endere[cç]o|onde\s+fica|localiza[cç][aã]o|como\s+chegar|onde\s+voc[eê]s?\s+(fica|est[aã]o)|maps?)\b/i;
// Só pedidos explícitos por atendimento humano — menções soltas a
// "atendente"/"humano" seguem no fluxo normal do bot.
const HUMAN_REQUEST_RE =
  /\b(falar\s+com\s+(algu[eé]m|um\s+humano|(um[a]?\s+)?atendente|uma\s+pessoa(\s+real)?)|quero\s+(um[a]?\s+)?atendente|chama(r)?\s+(um[a]?\s+)?atendente|me\s+passa\s+(pro|para\s+[oa])\s+atendente|atendimento\s+humano|n[aã]o\s+quero\s+falar\s+com\s+(rob[oô]|bot))\b/i;

function accountAddress(account: Account) {
  return String(account.address || '').trim();
}

function formatAddressReply(account: Account) {
  const address = accountAddress(account);
  if (!address) {
    return `Ainda não temos o endereço cadastrado do ${account.businessName}. Pode perguntar pelo WhatsApp do salão ou tentar de novo em breve.`;
  }
  return `Endereço do ${account.businessName}:\n${address}`;
}

@Injectable()
export class WhatsappBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly nlu: BookingNluService,
    private readonly employeeBot: WhatsappEmployeeBotService,
    private readonly employeeBookingNotify: EmployeeBookingNotifyService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async entsFor(accountId: string): Promise<EntitlementsMap> {
    return this.entitlements.forAccount(accountId);
  }

  /**
   * Interpretação de frase livre (áudio transcrito ou texto corrido) via LLM.
   * Retorna a resposta do fluxo se conseguiu extrair algo útil, senão null.
   */
  private async tryNluBooking(
    account: Account,
    services: { id: string; name: string; duration: number; price: number }[],
    base: SessionData,
    phone: string,
    text: string,
    client: { id: string; name: string } | null,
  ): Promise<WhatsappBotResult | null> {
    const ents = await this.entsFor(account.id);
    if (!hasFeature(ents, 'freeTextNlu')) return null;
    if (!this.nlu.isEnabled()) return null;
    // Só frases livres — menus/números/comandos seguem o fluxo normal.
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (words.length < 3) return null;

    const parsed = await this.nlu.extract({ text, services });
    if (!parsed) return null;

    if (parsed.intent === 'human') {
      return {
        replies: [
          'Combinado — vou avisar a equipe para te atender por aqui.',
        ],
        humanRequested: true,
      };
    }

    if (client && parsed.intent === 'cancel') {
      return this.startCancelFlow(account, client, services, phone);
    }
    if (client && parsed.intent === 'list') {
      return this.showFutureAppointments(account, client, services, phone);
    }

    if (!parsed.serviceId) return null;
    const service = services.find((s) => s.id === parsed.serviceId);
    if (!service) return null;

    const sessionBase: SessionData = {
      clientId: base.clientId,
      clientName: base.clientName,
      serviceId: service.id,
    };

    if (parsed.date && parsed.time) {
      return this.proceedWithSlot(account, services, sessionBase, phone, {
        date: parsed.date,
        time: parsed.time,
      });
    }
    if (parsed.date) {
      return this.timeMenu(
        account,
        service,
        sessionBase,
        phone,
        parsed.date,
        `Combinado: ${service.name} em ${this.formatDayLabel(parsed.date)}. Horários:`,
      );
    }
    return this.pathMenu(account, service, sessionBase, phone);
  }

  private parseChoice(text: string, max: number) {
    const n = parseInt(String(text).trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > max) return null;
    return n - 1;
  }

  /** Normaliza texto para comparar nomes (sem acento/caixa/pontuação). */
  private normalizeMatchText(value: string) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Nome e sobrenome no 1º contato: pelo menos 2 palavras com 2+ letras cada.
   */
  private parseClientFullName(text: string): string | null {
    const name = String(text || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 5) return null;
    const parts = name.split(' ').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts.some((part) => part.replace(/[^\p{L}]/gu, '').length < 2)) {
      return null;
    }
    return name;
  }

  private labelsMatch(needleRaw: string, labelRaw: string): boolean {
    const needle = this.normalizeMatchText(needleRaw);
    const label = this.normalizeMatchText(labelRaw);
    if (!needle || !label) return false;
    if (label === needle) return true;
    if (label.startsWith(needle) || needle.startsWith(label)) return true;

    // Títulos truncados pelo WhatsApp (botão 20 / lista 24).
    for (const max of [20, 24]) {
      if (labelRaw.trim().length > max) {
        const cut = this.normalizeMatchText(labelRaw.trim().slice(0, max - 1));
        if (
          cut &&
          (needle === cut || needle.startsWith(cut) || cut.startsWith(needle))
        ) {
          return true;
        }
      }
    }

    const words = label.split(' ').filter((w) => w.length >= 2);
    if (
      needle.length >= 2 &&
      words.some((w) => w === needle || w.startsWith(needle))
    ) {
      return true;
    }

    const needleWords = needle.split(' ').filter(Boolean);
    if (
      needleWords.length > 1 &&
      needleWords.every((w) => w.length >= 2 && label.includes(w))
    ) {
      return true;
    }

    return false;
  }

  private resolveChoice<T extends { id: string }>(
    text: string,
    items: T[],
    opts: {
      idPrefix?: string;
      label: (item: T) => string;
    },
  ): number | null {
    const trimmed = String(text || '').trim();
    if (!trimmed || items.length === 0) return null;

    if (opts.idPrefix) {
      const prefix = `${opts.idPrefix}:`;
      if (trimmed.startsWith(prefix)) {
        const id = trimmed.slice(prefix.length);
        const byId = items.findIndex((item) => item.id === id);
        if (byId >= 0) return byId;
      }
    }

    const byNumber = this.parseChoice(trimmed, items.length);
    if (byNumber !== null) return byNumber;

    const matches = items
      .map((item, index) => ({
        index,
        label: opts.label(item),
        hit: this.labelsMatch(trimmed, opts.label(item)),
      }))
      .filter((row) => row.hit);

    if (matches.length === 1) return matches[0].index;
    if (matches.length > 1) {
      const needle = this.normalizeMatchText(trimmed);
      const exact = matches.filter(
        (row) => this.normalizeMatchText(row.label) === needle,
      );
      if (exact.length === 1) return exact[0].index;
      return null;
    }

    return null;
  }

  /** Título curto no menu: 1º nome se for único entre os listados. */
  private employeeChoiceTitle(
    name: string,
    peers: { name: string }[],
  ): string {
    const full = String(name || '').trim() || 'Profissional';
    const first = full.split(/\s+/)[0] || full;
    const firstNorm = this.normalizeMatchText(first);
    const clashes = peers.filter((peer) => {
      const peerFirst = String(peer.name || '')
        .trim()
        .split(/\s+/)[0];
      return this.normalizeMatchText(peerFirst) === firstNorm;
    });
    const title = clashes.length <= 1 ? first : full;
    if (title.length <= 20) return title;
    return `${title.slice(0, 19)}…`;
  }

  private menuReply(
    bodyText: string,
    choices: WhatsappMenuChoice[],
    opts?: {
      listButton?: string;
      footerText?: string;
      unresolved?: boolean;
    },
  ): WhatsappBotResult {
    const numbered = choices
      .map((c, idx) => `${idx + 1}. ${c.title}`)
      .join('\n');
    return {
      replies: [
        `${bodyText}\n${numbered}\n\nToque numa opção ou responda com o número.`,
      ],
      interactive: [
        {
          text: bodyText,
          choices,
          listButton: opts?.listButton || 'Ver opções',
          footerText: opts?.footerText,
        },
      ],
      ...(opts?.unresolved ? { unresolved: true } : {}),
    };
  }

  private withUnresolved(result: WhatsappBotResult): WhatsappBotResult {
    return { ...result, unresolved: true };
  }

  private formatPrice(price: number) {
    return Number(price || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  /** Título do botão com preço (máx. 20 chars no WhatsApp). */
  private serviceChoiceTitle(name: string, price: number) {
    const pricePart = ` ${this.formatPrice(price)}`;
    const max = 20;
    if (name.length + pricePart.length <= max) {
      return `${name}${pricePart}`;
    }
    const room = max - pricePart.length;
    if (room <= 1) return pricePart.trim().slice(0, max);
    return `${name.slice(0, room - 1)}…${pricePart}`;
  }

  private serviceMenu(
    bodyText: string,
    services: { id: string; name: string; duration: number; price: number }[],
  ): WhatsappBotResult {
    return this.menuReply(
      bodyText,
      services.map((s) => ({
        id: `svc:${s.id}`,
        title: this.serviceChoiceTitle(s.name, s.price),
        description: `${s.duration} min · ${this.formatPrice(s.price)}`,
      })),
      { listButton: 'Ver serviços' },
    );
  }

  private formatAppointmentLine(appt: {
    date: string;
    time: string;
    service?: { name: string } | null;
    employee?: { name: string } | null;
    title?: string;
  }) {
    const what =
      appt.service?.name ||
      (appt.title ? appt.title : 'Agendamento');
    const withWho = appt.employee?.name
      ? ` com ${appt.employee.name}`
      : '';
    return `${what}${withWho} — ${this.formatSlotLabel(appt.date, appt.time)}`;
  }

  private appointmentChoiceTitle(appt: {
    date: string;
    time: string;
    service?: { name: string } | null;
  }) {
    const label = `${this.formatDayLabel(appt.date)} ${appt.time}`;
    const serviceName = appt.service?.name || '';
    if (!serviceName) return label.slice(0, 20);
    const combined = `${serviceName} ${label}`;
    if (combined.length <= 20) return combined;
    const room = 20 - label.length - 1;
    if (room < 2) return label.slice(0, 20);
    return `${serviceName.slice(0, room - 1)}… ${label}`;
  }

  private nowStamp() {
    const now = new Date();
    return `${this.localDateStr(now)}_${this.pad(now.getHours())}:${this.pad(now.getMinutes())}`;
  }

  private async listFutureAppointments(
    accountId: string,
    clientId: string,
    phone: string,
  ) {
    const today = this.localDateStr(new Date());
    const rows = await this.prisma.appointment.findMany({
      where: {
        accountId,
        status: 'scheduled',
        kind: 'service',
        OR: [{ clientId }, { clientPhone: phone }],
        date: { gte: today },
      },
      include: {
        service: { select: { name: true } },
        employee: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
    });
    const stamp = this.nowStamp();
    return rows.filter((a) => `${a.date}_${a.time}` > stamp);
  }

  private employeeMenu(
    bodyText: string,
    employees: { id: string; name: string }[],
    opts?: { includeSofPick?: boolean },
  ): WhatsappBotResult {
    const choices: WhatsappMenuChoice[] = employees.map((e) => ({
      id: `emp:${e.id}`,
      title: this.employeeChoiceTitle(e.name, employees),
      description: e.name,
    }));
    if (opts?.includeSofPick) {
      choices.push({
        id: 'emp:auto',
        title: 'Deixa a Sof escolher',
        description: 'Quem estiver livre nesse horário',
      });
    }
    return this.menuReply(bodyText, choices, {
      listButton: 'Ver profissionais',
    });
  }

  private isSofPickChoice(text: string, employeeCount: number) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return false;
    if (trimmed === 'emp:auto') return true;
    if (/^(sof|deixa a sof|qualquer|tanto faz)$/i.test(trimmed)) return true;
    if (/deixa a sof|sof escolher/i.test(trimmed)) return true;
    const byNumber = this.parseChoice(trimmed, employeeCount + 1);
    return byNumber === employeeCount;
  }

  private isTimeFirstChoice(text: string, employeeCount: number) {
    const trimmed = String(text || '').trim();
    if (!trimmed) return false;
    if (trimmed === 'path:time') return true;
    if (/escolher hor[aá]rio|qualquer hor[aá]rio|hor[aá]rio primeiro/i.test(trimmed)) {
      return true;
    }
    const byNumber = this.parseChoice(trimmed, employeeCount + 1);
    return byNumber === employeeCount;
  }

  private confirmMenu(bodyText: string): WhatsappBotResult {
    return this.menuReply(
      bodyText,
      [
        {
          id: 'confirm:yes',
          title: 'Sim',
          description: 'Confirmar esta ação',
        },
        {
          id: 'confirm:no',
          title: 'Não',
          description: 'Voltar sem confirmar',
        },
      ],
      { listButton: 'Confirmar' },
    );
  }

  private pad(n: number) {
    return String(n).padStart(2, '0');
  }

  private localDateStr(date: Date) {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  private formatSlotLabel(date: string, time: string) {
    return `${this.formatDayLabel(date)} ${time}`;
  }

  private formatDayLabel(date: string) {
    const today = this.localDateStr(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = this.localDateStr(tomorrowDate);
    if (date === today) return 'Hoje';
    if (date === tomorrow) return 'Amanhã';
    const [, m, d] = date.split('-');
    return `${d}/${m}`;
  }

  private parseDateTime(text: string) {
    const match = String(text).match(DATETIME_RE);
    if (!match) return null;
    const [, dd, mm, hh, min] = match.map(Number);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) {
      return null;
    }
    const date = this.resolveCalendarDate(dd, mm);
    if (!date) return null;
    const time = `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return { date, time };
  }

  /** dd/mm → yyyy-mm-dd (se já passou neste ano, usa o próximo). */
  private parseDateOnly(text: string): string | null {
    const match = String(text || '')
      .trim()
      .match(DATE_ONLY_RE);
    if (!match) return null;
    const dd = Number(match[1]);
    const mm = Number(match[2]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return this.resolveCalendarDate(dd, mm);
  }

  private resolveCalendarDate(dd: number, mm: number): string | null {
    const today = this.localDateStr(new Date());
    let year = new Date().getFullYear();
    let date = `${year}-${this.pad(mm)}-${this.pad(dd)}`;
    const probe = new Date(year, mm - 1, dd);
    if (
      probe.getFullYear() !== year ||
      probe.getMonth() !== mm - 1 ||
      probe.getDate() !== dd
    ) {
      return null;
    }
    if (date < today) {
      year += 1;
      date = `${year}-${this.pad(mm)}-${this.pad(dd)}`;
      const nextProbe = new Date(year, mm - 1, dd);
      if (
        nextProbe.getFullYear() !== year ||
        nextProbe.getMonth() !== mm - 1 ||
        nextProbe.getDate() !== dd
      ) {
        return null;
      }
    }
    return date;
  }

  private parseTimeOnly(text: string): string | null {
    const match = String(text || '')
      .trim()
      .match(TIME_ONLY_RE);
    if (!match) return null;
    const hh = Number(match[1]);
    const min = Number(match[2]);
    if (hh > 23 || min > 59) return null;
    return `${this.pad(hh)}:${this.pad(min)}`;
  }

  private parseTimeSelection(
    text: string,
    date: string,
    offered: string[],
  ): string | 'custom' | null {
    const trimmed = String(text || '').trim();
    if (CUSTOM_TIME_RE.test(trimmed)) return 'custom';

    const timeId = trimmed.match(TIME_ID_RE);
    if (timeId) return timeId[1];

    const slotId = trimmed.match(SLOT_ID_RE);
    if (slotId && slotId[1] === date) return slotId[2];

    const byNumber = this.parseChoice(trimmed, offered.length + 1);
    if (byNumber !== null) {
      if (byNumber === offered.length) return 'custom';
      return offered[byNumber];
    }

    if (offered.some((t) => t === trimmed)) return trimmed;

    const byLabel = offered.find(
      (t) =>
        this.formatSlotLabel(date, t).toLowerCase() === trimmed.toLowerCase(),
    );
    if (byLabel) return byLabel;

    const asTime = this.parseTimeOnly(trimmed);
    if (asTime) return asTime;

    const asDateTime = this.parseDateTime(trimmed);
    if (asDateTime && asDateTime.date === date) return asDateTime.time;

    return null;
  }

  private async employeesForService(accountId: string, serviceId: string) {
    return this.prisma.employee.findMany({
      where: {
        accountId,
        services: { some: { serviceId } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Horários livres num dia específico (até `limit`). */
  private async findSlotsOnDate(
    account: Account,
    employees: { id: string }[],
    date: string,
    durationMinutes: number,
    limit = 5,
  ): Promise<string[]> {
    if (employees.length === 0) return [];

    const hours = normalizeOpeningHours(account.openingHours);
    const day = getDaySchedule(hours, date);
    if (!day.open) return [];

    const today = this.localDateStr(new Date());
    let startMin = timeToMinutes(day.start);
    if (date === today) {
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const rounded = Math.ceil((nowMin + 1) / 30) * 30;
      startMin = Math.max(startMin, rounded);
    }
    const endMin = timeToMinutes(day.end);
    if (startMin + durationMinutes > endMin) return [];

    const busyByEmployee = new Map<
      string,
      Awaited<ReturnType<typeof listBusySlots>>
    >();
    for (const emp of employees) {
      busyByEmployee.set(
        emp.id,
        await listBusySlots(this.prisma, {
          accountId: account.id,
          employeeId: emp.id,
          date,
        }),
      );
    }

    const times: string[] = [];
    for (let t = startMin; t + durationMinutes <= endMin; t += 30) {
      const time = minutesToTime(t);
      const anyFree = employees.some(
        (emp) =>
          !hasScheduleConflict(
            busyByEmployee.get(emp.id) || [],
            time,
            durationMinutes,
          ),
      );
      if (!anyFree) continue;
      times.push(time);
      if (times.length >= limit) break;
    }
    return times;
  }

  private async resolveSlotEmployees(
    accountId: string,
    serviceId: string,
    employeeId?: string,
  ) {
    const all = await this.employeesForService(accountId, serviceId);
    if (!employeeId) return all;
    return all.filter((e) => e.id === employeeId);
  }

  private async availableEmployeesAt(
    account: Account,
    serviceId: string,
    date: string,
    time: string,
    durationMinutes: number,
  ) {
    const employees = await this.employeesForService(account.id, serviceId);
    const free: { id: string; name: string }[] = [];
    for (const emp of employees) {
      const hoursCheck = checkWithinOpeningHours(
        account.openingHours,
        date,
        time,
        durationMinutes,
      );
      if (!hoursCheck.ok) continue;
      const busy = await listBusySlots(this.prisma, {
        accountId: account.id,
        employeeId: emp.id,
        date,
      });
      if (!hasScheduleConflict(busy, time, durationMinutes)) {
        free.push({ id: emp.id, name: emp.name });
      }
    }
    return free;
  }

  private async pathMenu(
    account: Account,
    service: { id: string; name: string },
    sessionBase: SessionData,
    customerPhone: string,
    intro?: string,
  ): Promise<WhatsappBotResult> {
    const employees = await this.employeesForService(account.id, service.id);
    if (employees.length === 0) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_service',
        data: {
          clientId: sessionBase.clientId,
          clientName: sessionBase.clientName,
        },
      });
      const services = await this.prisma.service.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'asc' },
      });
      return this.serviceMenu(
        `Por enquanto nenhum profissional faz ${service.name}. Escolha outro serviço:`,
        services,
      );
    }

    const entsPath = await this.entsFor(account.id);
    const includeSof = hasFeature(entsPath, 'sofPickProfessional');

    if (!hasFeature(entsPath, 'bookingPathChoice')) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_employee',
        data: {
          clientId: sessionBase.clientId,
          clientName: sessionBase.clientName,
          serviceId: service.id,
        },
      });
      return this.employeeMenu(
        intro || `Combinado: ${service.name}. Quem você prefere?`,
        employees,
        { includeSofPick: includeSof },
      );
    }

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_path',
      data: {
        clientId: sessionBase.clientId,
        clientName: sessionBase.clientName,
        serviceId: service.id,
      },
    });

    const body =
      intro ||
      `Combinado: ${service.name}. Quem você prefere?`;

    const choices: WhatsappMenuChoice[] = [
      ...employees.map((e) => ({
        id: `emp:${e.id}`,
        title: this.employeeChoiceTitle(e.name, employees),
        description: e.name,
      })),
      {
        id: 'path:time',
        title: 'Escolher horário',
        description: 'Ver horários livres primeiro',
      },
    ];
    if (includeSof) {
      choices.splice(employees.length, 0, {
        id: 'emp:auto',
        title: 'Deixa a Sof escolher',
        description: 'Quem estiver livre',
      });
    }

    return this.menuReply(body, choices, {
      listButton: 'Ver opções',
    });
  }

  private sessionCore(sessionBase: SessionData, serviceId: string): SessionData {
    return {
      clientId: sessionBase.clientId,
      clientName: sessionBase.clientName,
      serviceId,
      ...(sessionBase.employeeId
        ? { employeeId: sessionBase.employeeId }
        : {}),
    };
  }

  private async dayMenu(
    account: Account,
    service: { id: string; name: string; duration: number },
    sessionBase: SessionData,
    customerPhone: string,
    intro?: string,
  ): Promise<WhatsappBotResult> {
    const allEmployees = await this.employeesForService(account.id, service.id);
    if (allEmployees.length === 0) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_service',
        data: {
          clientId: sessionBase.clientId,
          clientName: sessionBase.clientName,
        },
      });
      const services = await this.prisma.service.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'asc' },
      });
      return this.serviceMenu(
        `Por enquanto nenhum profissional faz ${service.name}. Escolha outro serviço:`,
        services,
      );
    }

    const employees = await this.resolveSlotEmployees(
      account.id,
      service.id,
      sessionBase.employeeId,
    );

    if (employees.length === 0) {
      return this.pathMenu(
        account,
        service,
        {
          clientId: sessionBase.clientId,
          clientName: sessionBase.clientName,
        },
        customerPhone,
        'Esse profissional não faz esse serviço. Escolha de novo:',
      );
    }

    const data = this.sessionCore(sessionBase, service.id);
    const today = this.localDateStr(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = this.localDateStr(tomorrowDate);

    const [todayTimes, tomorrowTimes] = await Promise.all([
      this.findSlotsOnDate(account, employees, today, service.duration, 1),
      this.findSlotsOnDate(account, employees, tomorrow, service.duration, 1),
    ]);

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_day',
      data,
    });

    const preferredName = sessionBase.employeeId
      ? employees[0]?.name
      : null;
    const body =
      intro ||
      (preferredName
        ? `Com ${preferredName}. Qual dia você prefere?`
        : 'Qual dia você prefere?');

    const choices: WhatsappMenuChoice[] = [];
    if (todayTimes.length > 0) {
      choices.push({
        id: 'day:today',
        title: 'Hoje',
        description: 'Ver horários de hoje',
      });
    }
    if (tomorrowTimes.length > 0) {
      choices.push({
        id: 'day:tomorrow',
        title: 'Amanhã',
        description: 'Ver horários de amanhã',
      });
    }
    choices.push({
      id: 'day:other',
      title: 'Outra data',
      description: 'Informar dia (dd/mm)',
    });

    return this.menuReply(body, choices, {
      listButton: 'Ver dias',
    });
  }

  private async timeMenu(
    account: Account,
    service: { id: string; name: string; duration: number },
    sessionBase: SessionData,
    customerPhone: string,
    date: string,
    intro?: string,
  ): Promise<WhatsappBotResult> {
    const employees = await this.resolveSlotEmployees(
      account.id,
      service.id,
      sessionBase.employeeId,
    );
    if (employees.length === 0) {
      return this.pathMenu(
        account,
        service,
        {
          clientId: sessionBase.clientId,
          clientName: sessionBase.clientName,
        },
        customerPhone,
        'Esse profissional não faz esse serviço. Escolha de novo:',
      );
    }

    const day = getDaySchedule(
      normalizeOpeningHours(account.openingHours),
      date,
    );
    if (!day.open) {
      return this.dayMenu(
        account,
        service,
        sessionBase,
        customerPhone,
        `Nesse dia (${this.formatDayLabel(date)}) estamos fechados. Escolha outro:`,
      );
    }

    const times = await this.findSlotsOnDate(
      account,
      employees,
      date,
      service.duration,
      5,
    );

    const data: SessionData = {
      ...this.sessionCore(sessionBase, service.id),
      date,
    };

    if (times.length === 0) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_custom_time',
        data,
      });
      return {
        replies: [
          `${intro || `Em ${this.formatDayLabel(date)} não achei horários livres na lista.`}\nMe diga um horário assim: 15:00\nFuncionamento: ${day.start}–${day.end}`,
        ],
      };
    }

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_time',
      data,
    });

    const body =
      intro || `Horários em ${this.formatDayLabel(date)}:`;

    const choices: WhatsappMenuChoice[] = [
      ...times.map((time) => ({
        id: `time:${time}`,
        title: time,
        description: `${this.formatDayLabel(date)} às ${time}`,
      })),
      {
        id: 'time:custom',
        title: 'Outro horário',
        description: 'Enviar hora (hh:mm)',
      },
    ];

    return this.menuReply(body, choices, {
      listButton: 'Ver horários',
      footerText: 'Ou digite hh:mm',
    });
  }

  private async askCustomDate(
    account: Account,
    service: { id: string; name: string; duration: number },
    sessionBase: SessionData,
    customerPhone: string,
    intro?: string,
  ): Promise<WhatsappBotResult> {
    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_custom_date',
      data: this.sessionCore(sessionBase, service.id),
    });
    return {
      replies: [
        `${intro || 'Qual data você prefere?'}\nEnvie assim: 25/12\nFuncionamento: ${formatOpeningHoursSummary(account.openingHours)}`,
      ],
    };
  }

  private async proceedWithSlot(
    account: Account,
    services: { id: string; name: string; duration: number; price: number }[],
    sessionData: SessionData,
    customerPhone: string,
    when: SlotOption,
  ): Promise<WhatsappBotResult> {
    const service = services.find((s) => s.id === sessionData.serviceId);
    if (!service) {
      await this.resetSession(account.id, customerPhone);
      return this.serviceMenu(
        'Vamos recomeçar — qual serviço você quer agendar?',
        services,
      );
    }

    const hoursCheck = checkWithinOpeningHours(
      account.openingHours,
      when.date,
      when.time,
      service.duration,
    );
    if (!hoursCheck.ok) {
      if (hoursCheck.reason === 'closed') {
        return this.dayMenu(
          account,
          service,
          sessionData,
          customerPhone,
          `Nesse dia (${hoursCheck.label}) estamos fechados. Escolha outro:`,
        );
      }
      return this.timeMenu(
        account,
        service,
        sessionData,
        customerPhone,
        when.date,
        `Horário fora do expediente (${hoursCheck.day.start}–${hoursCheck.day.end}). Escolha outro:`,
      );
    }

    const free = await this.availableEmployeesAt(
      account,
      service.id,
      when.date,
      when.time,
      service.duration,
    );

    if (free.length === 0) {
      return this.timeMenu(
        account,
        service,
        sessionData,
        customerPhone,
        when.date,
        'Nesse horário ninguém está livre. Escolha outro:',
      );
    }

    const baseData: SessionData = {
      clientId: sessionData.clientId,
      clientName: sessionData.clientName,
      serviceId: service.id,
      date: when.date,
      time: when.time,
    };

    // Caminho profissional → horário: confirma se o escolhido ainda está livre
    if (sessionData.employeeId) {
      const preferred = free.find((e) => e.id === sessionData.employeeId);
      if (preferred) {
        await this.saveSession(account.id, customerPhone, {
          step: 'awaiting_confirmation',
          data: { ...baseData, employeeId: preferred.id },
        });
        return this.confirmMenu(
          `Fechar ${service.name} com ${preferred.name} em ${when.date.split('-').reverse().join('/')} às ${when.time}?`,
        );
      }

      // Preferido ocupado: oferece quem está livre nesse horário (+ Sof)
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_employee',
        data: baseData,
      });
      if (free.length === 1) {
        await this.saveSession(account.id, customerPhone, {
          step: 'awaiting_confirmation',
          data: { ...baseData, employeeId: free[0].id },
        });
        return this.confirmMenu(
          `${free[0].name} está livre nesse horário. Fechar ${service.name} em ${when.date.split('-').reverse().join('/')} às ${when.time}?`,
        );
      }
      {
        const entsEmp = await this.entsFor(account.id);
        return this.employeeMenu(
          'Esse profissional não está livre nesse horário. Quem você prefere?',
          free,
          { includeSofPick: hasFeature(entsEmp, 'sofPickProfessional') },
        );
      }
    }

    // Caminho horário primeiro
    if (free.length === 1) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_confirmation',
        data: { ...baseData, employeeId: free[0].id },
      });
      return this.confirmMenu(
        `Fechar ${service.name} com ${free[0].name} em ${when.date.split('-').reverse().join('/')} às ${when.time}?`,
      );
    }

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_employee',
      data: baseData,
    });
    {
      const entsEmp = await this.entsFor(account.id);
      return this.employeeMenu(
        `Quem você prefere em ${this.formatSlotLabel(when.date, when.time)}?`,
        free,
        { includeSofPick: hasFeature(entsEmp, 'sofPickProfessional') },
      );
    }
  }

  private async saveSession(
    accountId: string,
    customerPhone: string,
    patch: { step: string; data: SessionData },
  ) {
    return this.prisma.whatsappSession.upsert({
      where: {
        accountId_customerPhone: { accountId, customerPhone },
      },
      create: {
        accountId,
        customerPhone,
        step: patch.step,
        data: patch.data as Prisma.InputJsonValue,
      },
      update: {
        step: patch.step,
        data: patch.data as Prisma.InputJsonValue,
      },
    });
  }

  private async resetSession(accountId: string, customerPhone: string) {
    await this.saveSession(accountId, customerPhone, {
      step: 'start',
      data: {},
    });
  }

  private async findClient(accountId: string, phone: string) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return this.prisma.client.findUnique({
      where: {
        accountId_phone: { accountId, phone: normalized },
      },
    });
  }

  private async startBooking(
    account: Account,
    customerPhone: string,
    client: { id: string; name: string },
    services: { id: string; name: string; duration: number; price: number }[],
  ): Promise<WhatsappBotResult> {
    const addressBit = accountAddress(account)
      ? ` Nosso endereço: ${accountAddress(account)}.`
      : '';
    return this.mainMenu(
      account,
      client,
      services,
      customerPhone,
      `Oi, ${client.name}! Aqui é a Sof, do ${account.businessName}.${addressBit}`,
    );
  }

  private async mainMenu(
    account: Account,
    client: { id: string; name: string },
    services: { id: string; name: string; duration: number; price: number }[],
    customerPhone: string,
    intro: string,
  ): Promise<WhatsappBotResult> {
    const future = await this.listFutureAppointments(
      account.id,
      client.id,
      customerPhone,
    );

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_service',
      data: { clientId: client.id, clientName: client.name },
    });

    if (future.length === 0) {
      return this.serviceMenu(
        `${intro} Qual serviço você quer agendar?`,
        services,
      );
    }

    const choices: WhatsappMenuChoice[] = [
      ...services.map((s) => ({
        id: `svc:${s.id}`,
        title: this.serviceChoiceTitle(s.name, s.price),
        description: `${s.duration} min · ${this.formatPrice(s.price)}`,
      })),
      {
        id: 'action:list',
        title: 'Ver agendamentos',
        description: 'Seus horários marcados',
      },
      {
        id: 'action:cancel',
        title: 'Cancelar horário',
        description: 'Cancelar um agendamento',
      },
    ];

    return this.menuReply(`${intro}\n\nO que você precisa?`, choices, {
      listButton: 'Ver opções',
    });
  }

  private async showFutureAppointments(
    account: Account,
    client: { id: string; name: string },
    services: { id: string; name: string; duration: number; price: number }[],
    customerPhone: string,
  ): Promise<WhatsappBotResult> {
    const future = await this.listFutureAppointments(
      account.id,
      client.id,
      customerPhone,
    );
    if (future.length === 0) {
      return this.mainMenu(
        account,
        client,
        services,
        customerPhone,
        'Você não tem agendamentos futuros.',
      );
    }

    const lines = future
      .map((a, idx) => `${idx + 1}. ${this.formatAppointmentLine(a)}`)
      .join('\n');

    return this.mainMenu(
      account,
      client,
      services,
      customerPhone,
      `Seus próximos agendamentos:\n${lines}`,
    );
  }

  private async startCancelFlow(
    account: Account,
    client: { id: string; name: string },
    services: { id: string; name: string; duration: number; price: number }[],
    customerPhone: string,
  ): Promise<WhatsappBotResult> {
    const future = await this.listFutureAppointments(
      account.id,
      client.id,
      customerPhone,
    );
    if (future.length === 0) {
      return this.mainMenu(
        account,
        client,
        services,
        customerPhone,
        'Você não tem agendamentos futuros para cancelar.',
      );
    }

    if (future.length === 1) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_cancel_confirm',
        data: {
          clientId: client.id,
          clientName: client.name,
          cancelAppointmentId: future[0].id,
        },
      });
      return this.confirmMenu(
        `Cancelar ${this.formatAppointmentLine(future[0])}?`,
      );
    }

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_cancel_pick',
      data: { clientId: client.id, clientName: client.name },
    });

    return this.menuReply(
      'Qual horário você quer cancelar?',
      future.map((a) => ({
        id: `appt:${a.id}`,
        title: this.appointmentChoiceTitle(a),
        description: this.formatAppointmentLine(a),
      })),
      { listButton: 'Ver horários' },
    );
  }

  async handleIncomingMessage({
    account,
    customerPhone,
    text,
  }: {
    account: Account;
    customerPhone: string;
    text: string;
  }): Promise<WhatsappBotResult> {
    const trimmed = String(text || '').trim();
    const lower = trimmed.toLowerCase();
    const phone = normalizePhone(customerPhone) || customerPhone;

    // Profissional com telefone cadastrado → fluxo próprio (não o de cliente).
    const employee = await this.employeeBot.findEmployee(account.id, phone);
    if (employee) {
      return this.employeeBot.handleIncomingMessage({
        account,
        employee,
        customerPhone: phone,
        text: trimmed,
      });
    }

    if (lower === 'cancelar' || lower === '/reset' || lower === 'reset') {
      await this.resetSession(account.id, phone);
      return {
        replies: [
          lower === '/reset' || lower === 'reset'
            ? 'Pronto, reiniciei a conversa. É só mandar uma mensagem quando quiser agendar.'
            : 'Combinado, cancelei o que estava em andamento. É só chamar de novo quando quiser marcar um horário.',
        ],
      };
    }

    if (ADDRESS_RE.test(trimmed) || lower === 'endereço' || lower === 'endereco') {
      return { replies: [formatAddressReply(account)] };
    }

    if (HUMAN_REQUEST_RE.test(trimmed)) {
      const entsHuman = await this.entsFor(account.id);
      if (!hasFeature(entsHuman, 'clientRequestHuman')) {
        return {
          replies: [
            'No momento não consigo transferir para um atendente por aqui. Use o menu para agendar ou cancelar.',
          ],
        };
      }
      return {
        replies: [
          'Combinado — vou avisar a equipe para te atender por aqui.',
        ],
        humanRequested: true,
      };
    }

    const services = await this.prisma.service.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'asc' },
    });
    const employeeCount = await this.prisma.employee.count({
      where: { accountId: account.id },
    });

    if (services.length === 0 || employeeCount === 0) {
      return {
        replies: [
          'Esse salão ainda está configurando o agendamento por aqui. Peça para tentarem de novo em instantes ou contate o número do salão.',
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
    const step = session?.step || 'start';
    const sessionData = (session?.data || {}) as SessionData;

    if (step === 'start') {
      const existingClient = await this.findClient(account.id, phone);
      if (existingClient) {
        const viaNlu = await this.tryNluBooking(
          account,
          services,
          { clientId: existingClient.id, clientName: existingClient.name },
          phone,
          trimmed,
          existingClient,
        );
        if (viaNlu) return viaNlu;
        return this.startBooking(account, phone, existingClient, services);
      }
      await this.saveSession(account.id, phone, {
        step: 'awaiting_name',
        data: {},
      });
      return {
        replies: [
          `Oi! Aqui é a Sof, do ${account.businessName}. Para começar, qual é o seu nome e sobrenome?`,
        ],
      };
    }

    if (step === 'awaiting_name') {
      const name = this.parseClientFullName(trimmed);
      if (!name) {
        return {
          replies: [
            'Me diga seu nome e sobrenome (ex.: Ana Silva).',
          ],
        };
      }
      const client = await this.prisma.client.upsert({
        where: {
          accountId_phone: { accountId: account.id, phone },
        },
        create: {
          accountId: account.id,
          name,
          phone,
        },
        update: { name },
      });
      return this.startBooking(account, phone, client, services);
    }

    if (step === 'awaiting_service') {
      const clientId = sessionData.clientId;
      const clientName = sessionData.clientName || 'Cliente';
      const client = clientId
        ? { id: clientId, name: clientName }
        : null;

      const future = client
        ? await this.listFutureAppointments(account.id, client.id, phone)
        : [];
      const manageCount = future.length > 0 ? 2 : 0;

      const wantsList =
        trimmed === 'action:list' ||
        /^ver agendamentos?$/i.test(trimmed);
      const wantsCancel =
        trimmed === 'action:cancel' ||
        /^cancelar (hor[aá]rio|agendamento)$/i.test(trimmed);

      const byNumber = this.parseChoice(
        trimmed,
        services.length + manageCount,
      );
      let action: 'list' | 'cancel' | null = null;
      if (wantsList) action = 'list';
      else if (wantsCancel) action = 'cancel';
      else if (byNumber !== null && byNumber >= services.length) {
        action = byNumber === services.length ? 'list' : 'cancel';
      }

      if (action && client) {
        if (future.length === 0) {
          return this.mainMenu(
            account,
            client,
            services,
            phone,
            'Você não tem agendamentos futuros.',
          );
        }
        if (action === 'list') {
          return this.showFutureAppointments(
            account,
            client,
            services,
            phone,
          );
        }
        return this.startCancelFlow(account, client, services, phone);
      }

      const idx = this.resolveChoice(trimmed, services, {
        idPrefix: 'svc',
        label: (s) => this.serviceChoiceTitle(s.name, s.price),
      });
      const idxByName =
        idx === null
          ? this.resolveChoice(trimmed, services, {
              idPrefix: 'svc',
              label: (s) => s.name,
            })
          : idx;
      const serviceIdx =
        idxByName !== null
          ? idxByName
          : byNumber !== null && byNumber < services.length
            ? byNumber
            : null;

      if (serviceIdx === null) {
        const viaNlu = await this.tryNluBooking(
          account,
          services,
          sessionData,
          phone,
          trimmed,
          client,
        );
        if (viaNlu) return viaNlu;
        if (client) {
          return this.withUnresolved(
            await this.mainMenu(
              account,
              client,
              services,
              phone,
              'Não entendi.',
            ),
          );
        }
        return this.withUnresolved(
          this.serviceMenu('Não entendi. Escolha um serviço:', services),
        );
      }
      const service = services[serviceIdx];
      return this.pathMenu(account, service, sessionData, phone);
    }

    if (step === 'awaiting_cancel_pick') {
      const clientId = sessionData.clientId;
      const clientName = sessionData.clientName || 'Cliente';
      if (!clientId) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }
      const client = { id: clientId, name: clientName };
      const future = await this.listFutureAppointments(
        account.id,
        client.id,
        phone,
      );
      if (future.length === 0) {
        return this.mainMenu(
          account,
          client,
          services,
          phone,
          'Você não tem agendamentos futuros para cancelar.',
        );
      }

      const idx = this.resolveChoice(trimmed, future, {
        idPrefix: 'appt',
        label: (a) => this.appointmentChoiceTitle(a),
      });
      if (idx === null) {
        return this.withUnresolved(
          this.menuReply(
            'Não entendi. Qual horário você quer cancelar?',
            future.map((a) => ({
              id: `appt:${a.id}`,
              title: this.appointmentChoiceTitle(a),
              description: this.formatAppointmentLine(a),
            })),
            { listButton: 'Ver horários' },
          ),
        );
      }

      const appt = future[idx];
      await this.saveSession(account.id, phone, {
        step: 'awaiting_cancel_confirm',
        data: {
          clientId: client.id,
          clientName: client.name,
          cancelAppointmentId: appt.id,
        },
      });
      return this.confirmMenu(
        `Cancelar ${this.formatAppointmentLine(appt)}?`,
      );
    }

    if (step === 'awaiting_cancel_confirm') {
      const clientId = sessionData.clientId;
      const clientName = sessionData.clientName || 'Cliente';
      const apptId = sessionData.cancelAppointmentId;
      const isYes =
        AFFIRMATIVE.includes(lower) || trimmed === 'confirm:yes';
      const isNo = NEGATIVE.includes(lower) || trimmed === 'confirm:no';

      if (!clientId || !apptId) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }
      const client = { id: clientId, name: clientName };

      if (isNo) {
        return this.mainMenu(
          account,
          client,
          services,
          phone,
          'Combinado, mantive o horário.',
        );
      }

      if (!isYes) {
        const appt = await this.prisma.appointment.findFirst({
          where: {
            id: apptId,
            accountId: account.id,
            status: 'scheduled',
            OR: [{ clientId }, { clientPhone: phone }],
          },
          include: {
            service: { select: { name: true } },
            employee: { select: { name: true } },
          },
        });
        return this.confirmMenu(
          appt
            ? `Cancelar ${this.formatAppointmentLine(appt)}?`
            : 'Confirma o cancelamento? Toque em Sim ou Não.',
        );
      }

      const existing = await this.prisma.appointment.findFirst({
        where: {
          id: apptId,
          accountId: account.id,
          status: 'scheduled',
          kind: 'service',
          OR: [{ clientId }, { clientPhone: phone }],
        },
        include: {
          service: { select: { name: true } },
          employee: { select: { name: true } },
        },
      });

      if (!existing) {
        return this.mainMenu(
          account,
          client,
          services,
          phone,
          'Esse horário já não estava marcado.',
        );
      }

      const stamp = this.nowStamp();
      if (`${existing.date}_${existing.time}` <= stamp) {
        return this.mainMenu(
          account,
          client,
          services,
          phone,
          'Esse horário já passou; não dá para cancelar por aqui.',
        );
      }

      const appointment = await this.prisma.appointment.update({
        where: { id: existing.id },
        data: { status: 'cancelled' },
      });
      const shaped = serializeDates(appointment);
      this.realtime.broadcast(account.id, 'appointment:updated', {
        appointment: shaped,
      });

      const followUp = await this.mainMenu(
        account,
        client,
        services,
        phone,
        `Pronto, cancelei ${this.formatAppointmentLine(existing)}.`,
      );
      return {
        ...followUp,
        appointment: shaped,
      };
    }

    if (step === 'awaiting_path') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const employees = await this.employeesForService(account.id, service.id);
      if (employees.length === 0) {
        return this.pathMenu(account, service, sessionData, phone);
      }

      if (this.isTimeFirstChoice(trimmed, employees.length)) {
        return this.dayMenu(
          account,
          service,
          {
            clientId: sessionData.clientId,
            clientName: sessionData.clientName,
            serviceId: service.id,
          },
          phone,
          `Combinado: ${service.name}. Qual dia você prefere?`,
        );
      }

      const idx = this.resolveChoice(trimmed, employees, {
        idPrefix: 'emp',
        label: (e) => e.name,
      });
      if (idx === null) {
        return this.withUnresolved(
          await this.pathMenu(
            account,
            service,
            sessionData,
            phone,
            'Não entendi. Escolha um profissional ou Escolher horário:',
          ),
        );
      }

      const employee = employees[idx];
      return this.dayMenu(
        account,
        service,
        {
          clientId: sessionData.clientId,
          clientName: sessionData.clientName,
          serviceId: service.id,
          employeeId: employee.id,
        },
        phone,
      );
    }

    if (step === 'awaiting_day') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const employees = await this.resolveSlotEmployees(
        account.id,
        service.id,
        sessionData.employeeId,
      );
      const today = this.localDateStr(new Date());
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrow = this.localDateStr(tomorrowDate);
      const [todayTimes, tomorrowTimes] = await Promise.all([
        this.findSlotsOnDate(account, employees, today, service.duration, 1),
        this.findSlotsOnDate(account, employees, tomorrow, service.duration, 1),
      ]);

      const dayOptions: Array<'today' | 'tomorrow' | 'other'> = [];
      if (todayTimes.length > 0) dayOptions.push('today');
      if (tomorrowTimes.length > 0) dayOptions.push('tomorrow');
      dayOptions.push('other');

      let chosen: 'today' | 'tomorrow' | 'other' | string | null = null;
      if (trimmed === 'day:today' || /^hoje$/i.test(trimmed)) {
        chosen = todayTimes.length > 0 ? 'today' : null;
      } else if (
        trimmed === 'day:tomorrow' ||
        /^amanh[aã]$/i.test(trimmed)
      ) {
        chosen = tomorrowTimes.length > 0 ? 'tomorrow' : null;
      } else if (
        trimmed === 'day:other' ||
        /^outra( data)?$/i.test(trimmed)
      ) {
        chosen = 'other';
      } else {
        const byNumber = this.parseChoice(trimmed, dayOptions.length);
        if (byNumber !== null) chosen = dayOptions[byNumber];
      }

      if (!chosen) {
        const asDate = this.parseDateOnly(trimmed);
        if (asDate) chosen = asDate;
      }
      if (!chosen) {
        const asDateTime = this.parseDateTime(trimmed);
        if (asDateTime) {
          return this.proceedWithSlot(
            account,
            services,
            sessionData,
            phone,
            asDateTime,
          );
        }
      }

      if (!chosen) {
        return this.withUnresolved(
          await this.dayMenu(
            account,
            service,
            sessionData,
            phone,
            'Não entendi. Escolha Hoje, Amanhã ou Outra data:',
          ),
        );
      }

      if (chosen === 'other') {
        return this.askCustomDate(account, service, sessionData, phone);
      }

      const date =
        chosen === 'today'
          ? today
          : chosen === 'tomorrow'
            ? tomorrow
            : chosen;

      return this.timeMenu(account, service, sessionData, phone, date);
    }

    if (step === 'awaiting_custom_date') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const asDateTime = this.parseDateTime(trimmed);
      if (asDateTime) {
        return this.proceedWithSlot(
          account,
          services,
          sessionData,
          phone,
          asDateTime,
        );
      }

      const date = this.parseDateOnly(trimmed);
      if (!date) {
        return {
          replies: [
            'Não consegui entender. Envie a data assim: 25/12\nOu digite /reset para recomeçar.',
          ],
          unresolved: true,
        };
      }

      return this.timeMenu(account, service, sessionData, phone, date);
    }

    if (step === 'awaiting_time') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      const date = sessionData.date;
      if (!service || !date) {
        if (service) {
          return this.dayMenu(account, service, sessionData, phone);
        }
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const employees = await this.resolveSlotEmployees(
        account.id,
        service.id,
        sessionData.employeeId,
      );
      const offered = await this.findSlotsOnDate(
        account,
        employees,
        date,
        service.duration,
        5,
      );
      const selection = this.parseTimeSelection(trimmed, date, offered);

      if (selection === 'custom') {
        await this.saveSession(account.id, phone, {
          step: 'awaiting_custom_time',
          data: { ...this.sessionCore(sessionData, service.id), date },
        });
        return {
          replies: [
            `Me diga o horário assim: 15:00\nFuncionamento: ${formatOpeningHoursSummary(account.openingHours)}`,
          ],
        };
      }

      if (!selection) {
        return this.withUnresolved(
          await this.timeMenu(
            account,
            service,
            sessionData,
            phone,
            date,
            'Não entendi. Escolha um horário da lista ou toque em Outro horário:',
          ),
        );
      }

      return this.proceedWithSlot(account, services, sessionData, phone, {
        date,
        time: selection,
      });
    }

    if (step === 'awaiting_custom_time') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      const date = sessionData.date;
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const asDateTime = this.parseDateTime(trimmed);
      if (asDateTime) {
        return this.proceedWithSlot(
          account,
          services,
          sessionData,
          phone,
          asDateTime,
        );
      }

      const time = this.parseTimeOnly(trimmed);
      if (!time || !date) {
        if (!date) {
          return this.askCustomDate(
            account,
            service,
            sessionData,
            phone,
            'Preciso da data primeiro. Qual dia?',
          );
        }
        return {
          replies: [
            'Não consegui entender. Envie o horário assim: 15:00\nOu digite /reset para recomeçar.',
          ],
          unresolved: true,
        };
      }

      return this.proceedWithSlot(account, services, sessionData, phone, {
        date,
        time,
      });
    }

    // Compat: sessões antigas em awaiting_slot / custom_datetime
    if (step === 'awaiting_slot' || step === 'awaiting_custom_datetime') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (service) {
        return this.dayMenu(
          account,
          service,
          sessionData,
          phone,
          'Vamos escolher o dia de novo:',
        );
      }
      await this.resetSession(account.id, phone);
      return this.serviceMenu(
        'Vamos recomeçar — qual serviço você quer agendar?',
        services,
      );
    }

    if (step === 'awaiting_employee') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      const { date, time } = sessionData;

      // Sessão antiga (sem data/hora): redireciona para path ou horário
      if (!service || !date || !time) {
        if (service) {
          return this.pathMenu(account, service, sessionData, phone);
        }
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const free = await this.availableEmployeesAt(
        account,
        service.id,
        date,
        time,
        service.duration,
      );
      if (free.length === 0) {
        return this.dayMenu(
          account,
          service,
          {
            clientId: sessionData.clientId,
            clientName: sessionData.clientName,
            serviceId: service.id,
            ...(sessionData.employeeId
              ? { employeeId: sessionData.employeeId }
              : {}),
          },
          phone,
          'Nesse horário ninguém está mais livre. Escolha outro dia:',
        );
      }

      if (
        this.isSofPickChoice(trimmed, free.length) &&
        hasFeature(await this.entsFor(account.id), 'sofPickProfessional')
      ) {
        const employee = free[0];
        await this.saveSession(account.id, phone, {
          step: 'awaiting_confirmation',
          data: { ...sessionData, employeeId: employee.id },
        });
        return this.confirmMenu(
          `Fechar ${service.name} com ${employee.name} em ${date.split('-').reverse().join('/')} às ${time}?`,
        );
      }

      const idx = this.resolveChoice(trimmed, free, {
        idPrefix: 'emp',
        label: (e) => e.name,
      });
      if (idx === null) {
        {
          const entsEmp = await this.entsFor(account.id);
          return this.withUnresolved(
            this.employeeMenu(
              `Não entendi. Quem você prefere em ${this.formatSlotLabel(date, time)}?`,
              free,
              { includeSofPick: hasFeature(entsEmp, 'sofPickProfessional') },
            ),
          );
        }
      }

      const employee = free[idx];
      await this.saveSession(account.id, phone, {
        step: 'awaiting_confirmation',
        data: { ...sessionData, employeeId: employee.id },
      });
      return this.confirmMenu(
        `Fechar ${service.name} com ${employee.name} em ${date.split('-').reverse().join('/')} às ${time}?`,
      );
    }

    // Compat: sessões antigas em awaiting_datetime → pedem dia de novo
    if (step === 'awaiting_datetime') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (service) {
        return this.dayMenu(
          account,
          service,
          sessionData,
          phone,
          'Vamos escolher o dia de novo:',
        );
      }
      await this.resetSession(account.id, phone);
      return this.serviceMenu(
        'Vamos recomeçar — qual serviço você quer agendar?',
        services,
      );
    }

    if (step === 'awaiting_confirmation') {
      const isYes =
        AFFIRMATIVE.includes(lower) || trimmed === 'confirm:yes';
      const isNo = NEGATIVE.includes(lower) || trimmed === 'confirm:no';

      if (isYes) {
        const { serviceId, employeeId, date, time, clientId } = sessionData;
        const service = services.find((s) => s.id === serviceId);
        if (!service || !employeeId || !date || !time || !serviceId) {
          await this.resetSession(account.id, phone);
          return this.serviceMenu(
            'Vamos recomeçar — qual serviço você quer agendar?',
            services,
          );
        }

        const hoursCheck = checkWithinOpeningHours(
          account.openingHours,
          date,
          time,
          service.duration,
        );
        if (!hoursCheck.ok) {
          if (hoursCheck.reason === 'closed') {
            return this.dayMenu(
              account,
              service,
              sessionData,
              phone,
              'Nesse dia estamos fechados. Escolha outro:',
            );
          }
          return this.timeMenu(
            account,
            service,
            sessionData,
            phone,
            date,
            `Horário fora do expediente (${hoursCheck.day.start}–${hoursCheck.day.end}). Escolha outro:`,
          );
        }

        const busy = await listBusySlots(this.prisma, {
          accountId: account.id,
          employeeId,
          date,
        });
        if (hasScheduleConflict(busy, time, service.duration)) {
          return this.timeMenu(
            account,
            service,
            sessionData,
            phone,
            date,
            'Esse horário acabou de ser preenchido. Escolha outro:',
          );
        }

        let client = clientId
          ? await this.prisma.client.findFirst({
              where: { id: clientId, accountId: account.id },
            })
          : null;
        if (!client) {
          client = await this.findClient(account.id, phone);
        }
        if (!client) {
          client = await this.prisma.client.create({
            data: {
              accountId: account.id,
              name:
                sessionData.clientName ||
                `Cliente WhatsApp ${phone.slice(-4)}`,
              phone,
            },
          });
        }

        const appointment = await this.prisma.appointment.create({
          data: {
            accountId: account.id,
            kind: 'service',
            employeeId,
            serviceId,
            durationMinutes: service.duration,
            clientId: client.id,
            clientName: client.name,
            clientPhone: client.phone,
            date,
            time,
            price: service.price,
            status: 'scheduled',
            source: 'whatsapp',
          },
        });
        await this.resetSession(account.id, phone);
        const shaped = serializeDates(appointment);
        this.realtime.broadcast(account.id, 'appointment:created', {
          appointment: shaped,
        });
        await this.employeeBookingNotify.notifyNewServiceBookings({
          accountId: account.id,
          appointmentIds: [appointment.id],
        });
        const lead = Number(account.whatsappReminderMinutes) || 0;
        const leadLabel = formatReminderLeadLabel(lead);
        const reminderLine =
          lead > 0
            ? ` Você recebe um lembrete no WhatsApp ${leadLabel} antes do horário.`
            : '';
        const address = accountAddress(account);
        return {
          replies: [
            address
              ? `Marcado!${reminderLine}\nEndereço: ${address}\nAté lá!`
              : `Marcado!${reminderLine} Até lá!`,
          ],
          appointment: shaped,
        };
      }
      if (isNo) {
        await this.resetSession(account.id, phone);
        return {
          replies: [
            'Sem problemas, não marquei nada. É só chamar de novo quando quiser agendar.',
          ],
        };
      }
      return this.confirmMenu(
        'Confirma o agendamento? Toque em Sim ou Não.',
      );
    }

    await this.resetSession(account.id, phone);
    return this.serviceMenu(
      'Vamos recomeçar — qual serviço você quer agendar?',
      services,
    );
  }
}
