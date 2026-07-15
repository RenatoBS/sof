import { Injectable } from '@nestjs/common';
import { Account, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../events/realtime.service';
import { serializeDates } from '../common/public-shapes';

type SessionData = {
  serviceId?: string;
  employeeId?: string;
  date?: string;
  time?: string;
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

  private listMenu<T>(items: T[], label: (item: T) => string) {
    return items.map((item, idx) => `${idx + 1}. ${label(item)}`).join('\n');
  }

  private parseChoice(text: string, max: number) {
    const n = parseInt(String(text).trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > max) return null;
    return n - 1;
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

  async handleIncomingMessage({
    account,
    customerPhone,
    text,
  }: {
    account: Account;
    customerPhone: string;
    text: string;
  }) {
    const trimmed = String(text || '').trim();
    const lower = trimmed.toLowerCase();

    if (lower === 'cancelar') {
      await this.resetSession(account.id, customerPhone);
      return {
        replies: [
          'Combinado, cancelei o que estava em andamento. É só chamar de novo quando quiser marcar um horário.',
        ],
      };
    }

    const services = await this.prisma.service.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'asc' },
    });
    const employees = await this.prisma.employee.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'asc' },
    });

    if (services.length === 0 || employees.length === 0) {
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
          customerPhone,
        },
      },
    });
    const step = session?.step || 'start';
    const sessionData = (session?.data || {}) as SessionData;

    if (step === 'start') {
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_service',
        data: {},
      });
      return {
        replies: [
          `Oi! Aqui é a Soft, do ${account.businessName}. Qual serviço você quer agendar?\n${this.listMenu(services, (s) => `${s.name} (${s.duration}min)`)}\n\nResponda com o número da opção.`,
        ],
      };
    }

    if (step === 'awaiting_service') {
      const idx = this.parseChoice(trimmed, services.length);
      if (idx === null) {
        return {
          replies: [
            `Não entendi. Responda com o número do serviço:\n${this.listMenu(services, (s) => s.name)}`,
          ],
        };
      }
      const service = services[idx];
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_employee',
        data: { serviceId: service.id },
      });
      return {
        replies: [
          `Combinado: ${service.name}. Com qual profissional?\n${this.listMenu(employees, (e) => `${e.name} — ${e.specialty}`)}`,
        ],
      };
    }

    if (step === 'awaiting_employee') {
      const idx = this.parseChoice(trimmed, employees.length);
      if (idx === null) {
        return {
          replies: [
            `Não entendi. Responda com o número do profissional:\n${this.listMenu(employees, (e) => e.name)}`,
          ],
        };
      }
      const employee = employees[idx];
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_datetime',
        data: { ...sessionData, employeeId: employee.id },
      });
      return {
        replies: [
          'Para quando? Me diga a data e o horário assim: 25/12 15:00',
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
      const employee = employees.find((e) => e.id === sessionData.employeeId);
      await this.saveSession(account.id, customerPhone, {
        step: 'awaiting_confirmation',
        data: { ...sessionData, ...when },
      });
      return {
        replies: [
          `Fechar ${service?.name} com ${employee?.name} em ${when.date.split('-').reverse().join('/')} às ${when.time}? (responda sim ou não)`,
        ],
      };
    }

    if (step === 'awaiting_confirmation') {
      if (AFFIRMATIVE.includes(lower)) {
        const { serviceId, employeeId, date, time } = sessionData;
        const service = services.find((s) => s.id === serviceId);
        if (!service || !employeeId || !date || !time || !serviceId) {
          await this.resetSession(account.id, customerPhone);
          return { replies: ['Vamos recomeçar — qual serviço você quer agendar?'] };
        }

        const appointment = await this.prisma.appointment.create({
          data: {
            accountId: account.id,
            employeeId,
            serviceId,
            clientName: `Cliente WhatsApp ${customerPhone.slice(-4)}`,
            clientPhone: customerPhone,
            date,
            time,
            price: service.price,
            status: 'confirmed',
            source: 'whatsapp',
          },
        });
        await this.resetSession(account.id, customerPhone);
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
      if (NEGATIVE.includes(lower)) {
        await this.resetSession(account.id, customerPhone);
        return {
          replies: [
            'Sem problemas, não marquei nada. É só chamar de novo quando quiser agendar.',
          ],
        };
      }
      return {
        replies: ['Responda "sim" para confirmar ou "não" para cancelar.'],
      };
    }

    await this.resetSession(account.id, customerPhone);
    return { replies: ['Vamos recomeçar — qual serviço você quer agendar?'] };
  }
}
