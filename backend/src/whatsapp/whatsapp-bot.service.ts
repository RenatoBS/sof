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

type SessionData = {
  clientId?: string;
  clientName?: string;
  serviceId?: string;
  employeeId?: string;
  date?: string;
  time?: string;
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
};

const DATETIME_RE = /(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/;
const AFFIRMATIVE = ['sim', 's', 'confirmar', 'confirmo', 'ok', 'fecha', 'fechado'];
const NEGATIVE = ['não', 'nao', 'n', 'cancelar'];
const CUSTOM_SLOT_RE = /^(outro|outra|custom|slot:custom)$/i;
const SLOT_ID_RE = /^slot:(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/;

@Injectable()
export class WhatsappBotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  private parseChoice(text: string, max: number) {
    const n = parseInt(String(text).trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > max) return null;
    return n - 1;
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

    const lower = trimmed.toLowerCase();
    const exact = items.findIndex(
      (item) => opts.label(item).toLowerCase() === lower,
    );
    if (exact >= 0) return exact;

    const starts = items.findIndex((item) =>
      opts.label(item).toLowerCase().startsWith(lower),
    );
    if (starts >= 0) return starts;

    return null;
  }

  private menuReply(
    bodyText: string,
    choices: WhatsappMenuChoice[],
    opts?: { listButton?: string; footerText?: string },
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
    };
  }

  private serviceMenu(
    bodyText: string,
    services: { id: string; name: string; duration: number }[],
  ): WhatsappBotResult {
    return this.menuReply(
      bodyText,
      services.map((s) => ({
        id: `svc:${s.id}`,
        title: s.name,
        description: `${s.duration} min`,
      })),
      { listButton: 'Ver serviços' },
    );
  }

  private employeeMenu(
    bodyText: string,
    employees: { id: string; name: string }[],
  ): WhatsappBotResult {
    return this.menuReply(
      bodyText,
      employees.map((e) => ({
        id: `emp:${e.id}`,
        title: e.name,
      })),
      { listButton: 'Ver profissionais' },
    );
  }

  private confirmMenu(bodyText: string): WhatsappBotResult {
    return this.menuReply(bodyText, [
      { id: 'confirm:yes', title: 'Sim' },
      { id: 'confirm:no', title: 'Não' },
    ]);
  }

  private pad(n: number) {
    return String(n).padStart(2, '0');
  }

  private localDateStr(date: Date) {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(date.getDate())}`;
  }

  private formatSlotLabel(date: string, time: string) {
    const today = this.localDateStr(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = this.localDateStr(tomorrowDate);
    if (date === today) return `Hoje ${time}`;
    if (date === tomorrow) return `Amanhã ${time}`;
    const [, m, d] = date.split('-');
    return `${d}/${m} ${time}`;
  }

  private parseDateTime(text: string) {
    const match = String(text).match(DATETIME_RE);
    if (!match) return null;
    const [, dd, mm, hh, min] = match.map(Number);
    const year = new Date().getFullYear();
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || min > 59) {
      return null;
    }
    const date = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const time = `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    return { date, time };
  }

  private parseSlotSelection(
    text: string,
    offered: SlotOption[],
  ): SlotOption | 'custom' | null {
    const trimmed = String(text || '').trim();
    if (CUSTOM_SLOT_RE.test(trimmed) || trimmed === 'slot:custom') {
      return 'custom';
    }

    const idMatch = trimmed.match(SLOT_ID_RE);
    if (idMatch) {
      return { date: idMatch[1], time: idMatch[2] };
    }

    // Menu numerado: 1..N = slots, N+1 = outro
    const byNumber = this.parseChoice(trimmed, offered.length + 1);
    if (byNumber !== null) {
      if (byNumber === offered.length) return 'custom';
      return offered[byNumber];
    }

    // Título tipo "Hoje 15:00" / "18/07 10:00"
    const byLabel = offered.find(
      (s) =>
        this.formatSlotLabel(s.date, s.time).toLowerCase() ===
        trimmed.toLowerCase(),
    );
    if (byLabel) return byLabel;

    const asDateTime = this.parseDateTime(trimmed);
    if (asDateTime) return asDateTime;

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

  /** Horários próximos em que há ao menos 1 profissional livre para o serviço. */
  private async findNearbySlots(
    account: Account,
    employees: { id: string }[],
    durationMinutes: number,
    limit = 5,
  ): Promise<SlotOption[]> {
    if (employees.length === 0) return [];

    const hours = normalizeOpeningHours(account.openingHours);
    const now = new Date();
    const slots: SlotOption[] = [];

    for (let dayOffset = 0; dayOffset < 14 && slots.length < limit; dayOffset++) {
      const dayDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset,
      );
      const date = this.localDateStr(dayDate);
      const day = getDaySchedule(hours, date);
      if (!day.open) continue;

      let startMin = timeToMinutes(day.start);
      if (dayOffset === 0) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const rounded = Math.ceil((nowMin + 1) / 30) * 30;
        startMin = Math.max(startMin, rounded);
      }
      const endMin = timeToMinutes(day.end);
      if (startMin + durationMinutes > endMin) continue;

      const busyByEmployee = new Map<string, Awaited<ReturnType<typeof listBusySlots>>>();
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
        slots.push({ date, time });
        if (slots.length >= limit) break;
      }
    }

    return slots;
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

  private async slotMenu(
    account: Account,
    service: { id: string; name: string; duration: number },
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

    const nearby = await this.findNearbySlots(
      account,
      employees,
      service.duration,
      5,
    );

    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_slot',
      data: {
        clientId: sessionBase.clientId,
        clientName: sessionBase.clientName,
        serviceId: service.id,
      },
    });

    const body =
      intro ||
      `Combinado: ${service.name}. Escolha um horário próximo ou mande o horário que preferir.`;

    if (nearby.length === 0) {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_custom_datetime',
        data: {
          clientId: sessionBase.clientId,
          clientName: sessionBase.clientName,
          serviceId: service.id,
        },
      });
      return {
        replies: [
          `${body}\n\nNão achei horários livres nos próximos dias. Me diga a data e o horário assim: 25/12 15:00\nFuncionamento: ${formatOpeningHoursSummary(account.openingHours)}`,
        ],
      };
    }

    const choices: WhatsappMenuChoice[] = [
      ...nearby.map((s) => ({
        id: `slot:${s.date}_${s.time}`,
        title: this.formatSlotLabel(s.date, s.time),
        description: `${s.date.split('-').reverse().join('/')} às ${s.time}`,
      })),
      {
        id: 'slot:custom',
        title: 'Outro horário',
        description: 'Enviar data e hora (dd/mm hh:mm)',
      },
    ];

    return this.menuReply(body, choices, {
      listButton: 'Ver horários',
      footerText: 'Ou digite dd/mm hh:mm',
    });
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
        return this.slotMenu(
          account,
          service,
          sessionData,
          customerPhone,
          `Nesse dia (${hoursCheck.label}) estamos fechados. Escolha outro horário:`,
        );
      }
      return this.slotMenu(
        account,
        service,
        sessionData,
        customerPhone,
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
      return this.slotMenu(
        account,
        service,
        sessionData,
        customerPhone,
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
    return this.employeeMenu(
      `Quem você prefere em ${this.formatSlotLabel(when.date, when.time)}?`,
      free,
    );
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
    services: { id: string; name: string; duration: number }[],
  ): Promise<WhatsappBotResult> {
    await this.saveSession(account.id, customerPhone, {
      step: 'awaiting_service',
      data: { clientId: client.id, clientName: client.name },
    });
    return this.serviceMenu(
      `Oi, ${client.name}! Aqui é a Sof, do ${account.businessName}. Qual serviço você quer agendar?`,
      services,
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
        return this.startBooking(account, phone, existingClient, services);
      }
      await this.saveSession(account.id, phone, {
        step: 'awaiting_name',
        data: {},
      });
      return {
        replies: [
          `Oi! Aqui é a Sof, do ${account.businessName}. Para começar, qual é o seu nome?`,
        ],
      };
    }

    if (step === 'awaiting_name') {
      const name = trimmed.replace(/\s+/g, ' ');
      if (name.length < 2) {
        return {
          replies: ['Me diga seu nome completo (ou como prefere ser chamado).'],
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
      const idx = this.resolveChoice(trimmed, services, {
        idPrefix: 'svc',
        label: (s) => s.name,
      });
      if (idx === null) {
        return this.serviceMenu('Não entendi. Escolha um serviço:', services);
      }
      const service = services[idx];
      return this.slotMenu(account, service, sessionData, phone);
    }

    if (step === 'awaiting_slot') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const employees = await this.employeesForService(account.id, service.id);
      const nearby = await this.findNearbySlots(
        account,
        employees,
        service.duration,
        5,
      );
      const selection = this.parseSlotSelection(trimmed, nearby);

      if (selection === 'custom') {
        await this.saveSession(account.id, phone, {
          step: 'awaiting_custom_datetime',
          data: {
            clientId: sessionData.clientId,
            clientName: sessionData.clientName,
            serviceId: service.id,
          },
        });
        return {
          replies: [
            `Me diga a data e o horário assim: 25/12 15:00\nFuncionamento: ${formatOpeningHoursSummary(account.openingHours)}`,
          ],
        };
      }

      if (!selection) {
        return this.slotMenu(
          account,
          service,
          sessionData,
          phone,
          'Não entendi. Escolha um horário da lista ou toque em Outro horário:',
        );
      }

      return this.proceedWithSlot(
        account,
        services,
        sessionData,
        phone,
        selection,
      );
    }

    if (step === 'awaiting_custom_datetime') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (!service) {
        await this.resetSession(account.id, phone);
        return this.serviceMenu(
          'Vamos recomeçar — qual serviço você quer agendar?',
          services,
        );
      }

      const when = this.parseDateTime(trimmed);
      if (!when) {
        return {
          replies: [
            'Não consegui entender. Envie no formato dd/mm hh:mm, por exemplo: 25/12 15:00\nOu digite /reset para recomeçar.',
          ],
        };
      }

      return this.proceedWithSlot(
        account,
        services,
        sessionData,
        phone,
        when,
      );
    }

    if (step === 'awaiting_employee') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      const { date, time } = sessionData;

      // Sessão antiga (sem data/hora): redireciona para escolha de horário
      if (!service || !date || !time) {
        if (service) {
          return this.slotMenu(account, service, sessionData, phone);
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
        return this.slotMenu(
          account,
          service,
          sessionData,
          phone,
          'Nesse horário ninguém está mais livre. Escolha outro:',
        );
      }

      const idx = this.resolveChoice(trimmed, free, {
        idPrefix: 'emp',
        label: (e) => e.name,
      });
      if (idx === null) {
        return this.employeeMenu(
          `Não entendi. Quem você prefere em ${this.formatSlotLabel(date, time)}?`,
          free,
        );
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

    // Compat: sessões antigas em awaiting_datetime → pedem horário de novo
    if (step === 'awaiting_datetime') {
      const service = services.find((s) => s.id === sessionData.serviceId);
      if (service) {
        return this.slotMenu(
          account,
          service,
          sessionData,
          phone,
          'Vamos escolher o horário de novo:',
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
          return this.slotMenu(
            account,
            service,
            sessionData,
            phone,
            hoursCheck.reason === 'closed'
              ? 'Nesse dia estamos fechados. Escolha outro horário:'
              : `Horário fora do expediente (${hoursCheck.day.start}–${hoursCheck.day.end}). Escolha outro:`,
          );
        }

        const busy = await listBusySlots(this.prisma, {
          accountId: account.id,
          employeeId,
          date,
        });
        if (hasScheduleConflict(busy, time, service.duration)) {
          return this.slotMenu(
            account,
            service,
            sessionData,
            phone,
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
            status: 'confirmed',
            source: 'whatsapp',
          },
        });
        await this.resetSession(account.id, phone);
        const shaped = serializeDates(appointment);
        this.realtime.broadcast(account.id, 'appointment:created', {
          appointment: shaped,
        });
        return {
          replies: [
            'Marcado! Você recebe um lembrete antes do horário. Até lá!',
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
