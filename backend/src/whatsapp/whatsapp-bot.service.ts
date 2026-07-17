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
  suggestFreeTimes,
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
  /** Texto para simulador / fallback se o menu falhar. */
  replies: string[];
  /** Menus interativos (botões ≤3, lista >3) enviados no WhatsApp real. */
  interactive?: WhatsappInteractiveMenu[];
  appointment?: ReturnType<typeof serializeDates>;
};

const DATETIME_RE = /(\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})/;
const AFFIRMATIVE = ['sim', 's', 'confirmar', 'confirmo', 'ok', 'fecha', 'fechado'];
const NEGATIVE = ['não', 'nao', 'n', 'cancelar'];

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

  /**
   * Resolve escolha por: id do botão (`svc:…` / `emp:…` / `confirm:yes`),
   * número, ou título aproximado.
   */
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

  private suggestOnDate(
    account: Account,
    busy: { time: string; duration: number }[],
    date: string,
    durationMinutes: number,
  ) {
    const day = getDaySchedule(
      normalizeOpeningHours(account.openingHours),
      date,
    );
    if (!day.open) return [] as string[];
    return suggestFreeTimes(
      busy,
      durationMinutes,
      timeToMinutes(day.start),
      timeToMinutes(day.end),
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
        return this.startBooking(
          account,
          phone,
          existingClient,
          services,
        );
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
        return this.serviceMenu(
          'Não entendi. Escolha um serviço:',
          services,
        );
      }
      const service = services[idx];
      const employeesForService = await this.prisma.employee.findMany({
        where: {
          accountId: account.id,
          services: { some: { serviceId: service.id } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (employeesForService.length === 0) {
        await this.saveSession(account.id, phone, {
          step: 'awaiting_service',
          data: {
            clientId: sessionData.clientId,
            clientName: sessionData.clientName,
          },
        });
        return this.serviceMenu(
          `Por enquanto nenhum profissional faz ${service.name}. Escolha outro serviço:`,
          services,
        );
      }
      await this.saveSession(account.id, phone, {
        step: 'awaiting_employee',
        data: {
          clientId: sessionData.clientId,
          clientName: sessionData.clientName,
          serviceId: service.id,
        },
      });
      return this.employeeMenu(
        `Combinado: ${service.name}. Com qual profissional?`,
        employeesForService,
      );
    }

    if (step === 'awaiting_employee') {
      const serviceId = sessionData.serviceId || '';
      const employeesForService = await this.prisma.employee.findMany({
        where: {
          accountId: account.id,
          services: { some: { serviceId } },
        },
        orderBy: { createdAt: 'asc' },
      });
      if (employeesForService.length === 0) {
        await this.saveSession(account.id, phone, {
          step: 'awaiting_service',
          data: {
            clientId: sessionData.clientId,
            clientName: sessionData.clientName,
          },
        });
        return this.serviceMenu(
          'Nenhum profissional disponível para esse serviço. Escolha outro:',
          services,
        );
      }
      const idx = this.resolveChoice(trimmed, employeesForService, {
        idPrefix: 'emp',
        label: (e) => e.name,
      });
      if (idx === null) {
        return this.employeeMenu(
          'Não entendi. Escolha um profissional:',
          employeesForService,
        );
      }
      const employee = employeesForService[idx];
      await this.saveSession(account.id, phone, {
        step: 'awaiting_datetime',
        data: { ...sessionData, employeeId: employee.id },
      });
      const hoursHint = formatOpeningHoursSummary(account.openingHours);
      return {
        replies: [
          `Para quando? Me diga a data e o horário assim: 25/12 15:00\nFuncionamento: ${hoursHint}`,
        ],
      };
    }

    if (step === 'awaiting_datetime') {
      const when = this.parseDateTime(trimmed);
      if (!when) {
        return {
          replies: [
            'Não consegui entender a data. Envie no formato dd/mm hh:mm, por exemplo: 25/12 15:00',
          ],
        };
      }
      const service = services.find((s) => s.id === sessionData.serviceId);
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: sessionData.employeeId,
          accountId: account.id,
        },
      });
      if (!service || !employee || !sessionData.employeeId) {
        await this.resetSession(account.id, phone);
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
        await this.saveSession(account.id, phone, {
          step: 'awaiting_datetime',
          data: sessionData,
        });
        if (hoursCheck.reason === 'closed') {
          return {
            replies: [
              `Nesse dia (${hoursCheck.label}) estamos fechados. Funcionamento: ${formatOpeningHoursSummary(account.openingHours)}. Escolha outra data/horário (dd/mm hh:mm).`,
            ],
          };
        }
        const busyOutside = await listBusySlots(this.prisma, {
          accountId: account.id,
          employeeId: sessionData.employeeId,
          date: when.date,
        });
        const suggestions = this.suggestOnDate(
          account,
          busyOutside,
          when.date,
          service.duration,
        );
        const tip =
          suggestions.length > 0
            ? ` Horários dentro do expediente: ${suggestions.join(', ')}.`
            : '';
        return {
          replies: [
            `Esse horário fica fora do nosso expediente (${hoursCheck.day.start}–${hoursCheck.day.end}).${tip} Envie outra data/horário (dd/mm hh:mm).`,
          ],
        };
      }

      const busy = await listBusySlots(this.prisma, {
        accountId: account.id,
        employeeId: sessionData.employeeId,
        date: when.date,
      });
      if (hasScheduleConflict(busy, when.time, service.duration)) {
        const suggestions = this.suggestOnDate(
          account,
          busy,
          when.date,
          service.duration,
        );
        const dateLabel = when.date.split('-').reverse().join('/');
        const tip =
          suggestions.length > 0
            ? ` Horários livres com ${employee.name} em ${dateLabel}: ${suggestions.join(', ')}. Ou me diga outra data/horário.`
            : ' Me diga outra data e horário no formato dd/mm hh:mm.';
        await this.saveSession(account.id, phone, {
          step: 'awaiting_datetime',
          data: sessionData,
        });
        return {
          replies: [
            `${employee.name} já tem compromisso nesse horário.${tip}`,
          ],
        };
      }

      await this.saveSession(account.id, phone, {
        step: 'awaiting_confirmation',
        data: { ...sessionData, ...when },
      });
      return this.confirmMenu(
        `Fechar ${service.name} com ${employee.name} em ${when.date.split('-').reverse().join('/')} às ${when.time}?`,
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
          await this.saveSession(account.id, phone, {
            step: 'awaiting_datetime',
            data: {
              clientId: sessionData.clientId,
              clientName: sessionData.clientName,
              serviceId,
              employeeId,
            },
          });
          return {
            replies: [
              hoursCheck.reason === 'closed'
                ? `Nesse dia estamos fechados. Escolha outra data/horário (dd/mm hh:mm).`
                : `Horário fora do expediente (${hoursCheck.day.start}–${hoursCheck.day.end}). Envie outra data/horário (dd/mm hh:mm).`,
            ],
          };
        }

        const busy = await listBusySlots(this.prisma, {
          accountId: account.id,
          employeeId,
          date,
        });
        if (hasScheduleConflict(busy, time, service.duration)) {
          const suggestions = this.suggestOnDate(
            account,
            busy,
            date,
            service.duration,
          );
          const tip =
            suggestions.length > 0
              ? ` Sugestões: ${suggestions.join(', ')}. Ou envie outra data/horário (dd/mm hh:mm).`
              : ' Envie outra data e horário (dd/mm hh:mm).';
          await this.saveSession(account.id, phone, {
            step: 'awaiting_datetime',
            data: {
              clientId: sessionData.clientId,
              clientName: sessionData.clientName,
              serviceId,
              employeeId,
            },
          });
          return {
            replies: [
              `Esse horário acabou de ser preenchido.${tip}`,
            ],
          };
        }

        let client =
          clientId
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
