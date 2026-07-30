import { Injectable, Logger } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isValidPhone, normalizePhone } from '../common/phone';
import { WhatsappApiService } from './whatsapp-api.service';

function formatFriendlyWhen(date: string, time: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return `${date} às ${time}`;
  const [, y, m, d] = match;
  return `${d}/${m}/${y} às ${time}`;
}

function buildEmployeeBookingMessage(opts: {
  businessName: string;
  clientName: string;
  serviceName: string;
  slots: Array<{ date: string; time: string }>;
  source: string;
}): string {
  const business = (opts.businessName || '').trim() || 'Estabelecimento';
  const client = (opts.clientName || '').trim() || 'Cliente';
  const service = (opts.serviceName || '').trim() || 'Serviço';
  const header =
    opts.slots.length > 1
      ? `Novos agendamentos na Sof (${business}):`
      : `Novo agendamento na Sof (${business}):`;

  const lines = [
    header,
    '',
    `Cliente: ${client}`,
    `Serviço: ${service}`,
  ];

  if (opts.slots.length === 1) {
    lines.push(`Quando: ${formatFriendlyWhen(opts.slots[0].date, opts.slots[0].time)}`);
  } else {
    lines.push('Horários:');
    for (const slot of opts.slots) {
      lines.push(`• ${formatFriendlyWhen(slot.date, slot.time)}`);
    }
  }

  const sourceLabel =
    opts.source === 'whatsapp'
      ? 'Origem: WhatsApp do cliente'
      : opts.source === 'manual'
        ? 'Origem: painel'
        : '';
  if (sourceLabel) {
    lines.push('');
    lines.push(sourceLabel);
  }

  return lines.join('\n');
}

/**
 * Avisa o profissional no WhatsApp da conta quando um agendamento
 * de serviço é criado no nome dele.
 */
@Injectable()
export class EmployeeBookingNotifyService {
  private readonly logger = new Logger(EmployeeBookingNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappApiService,
  ) {}

  private canSendFromAccount(account: Account): boolean {
    if (!account.whatsappConnectedAt) return false;
    if (this.whatsapp.provider() === 'uazapi') {
      const token = (account.whatsappInstanceToken || '').trim();
      return Boolean(token) || this.whatsapp.isConfigured();
    }
    return this.whatsapp.isConfigured();
  }

  /**
   * Best-effort: falhas só no log — nunca interrompe a criação do agendamento.
   */
  async notifyNewServiceBookings(opts: {
    accountId: string;
    appointmentIds: string[];
    /** Ex.: portal/bot do próprio profissional — ele já sabe do horário. */
    skipEmployeeId?: string;
  }): Promise<void> {
    const ids = [...new Set(opts.appointmentIds.filter(Boolean))];
    if (ids.length === 0) return;

    try {
      const account = await this.prisma.account.findUnique({
        where: { id: opts.accountId },
      });
      if (!account || account.status !== 'active') return;
      if (!this.canSendFromAccount(account)) return;

      const appointments = await this.prisma.appointment.findMany({
        where: {
          id: { in: ids },
          accountId: opts.accountId,
          kind: 'service',
          status: 'scheduled',
        },
        include: {
          employee: { select: { id: true, name: true, phone: true } },
          service: { select: { name: true } },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      });

      if (appointments.length === 0) return;

      // Agrupa por profissional (recorrência / lote).
      const byEmployee = new Map<string, typeof appointments>();
      for (const appt of appointments) {
        if (opts.skipEmployeeId && appt.employeeId === opts.skipEmployeeId) {
          continue;
        }
        const list = byEmployee.get(appt.employeeId) || [];
        list.push(appt);
        byEmployee.set(appt.employeeId, list);
      }

      for (const group of byEmployee.values()) {
        const employee = group[0].employee;
        const phone = normalizePhone(employee.phone);
        if (!isValidPhone(phone)) {
          this.logger.debug(
            `Sem telefone válido para avisar ${employee.name} (${employee.id}).`,
          );
          continue;
        }

        const message = buildEmployeeBookingMessage({
          businessName: account.businessName,
          clientName: group[0].clientName,
          serviceName: group[0].service?.name || 'Serviço',
          slots: group.map((a) => ({ date: a.date, time: a.time })),
          source: group[0].source,
        });

        try {
          await this.whatsapp.sendText(
            phone,
            message,
            account.whatsappInstanceToken || undefined,
          );
        } catch (err) {
          this.logger.warn(
            `Falha ao avisar profissional ${employee.id} sobre agendamento: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Falha no aviso de agendamento ao profissional: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
