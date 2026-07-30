import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../events/realtime.service';
import { serializeDates } from '../common/public-shapes';
import { normalizePhone } from '../common/phone';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { hasFeature } from '../entitlements/feature-catalog';

export const HANDOFF_THRESHOLDS = [1, 2, 3, 5] as const;
export type HandoffThreshold = (typeof HANDOFF_THRESHOLDS)[number];

export type HandoffReason = 'unresolved' | 'human_requested';
export type HandoffParty = 'client' | 'employee';

const HUMAN_PAUSE_MS = 60 * 60 * 1000;

@Injectable()
export class WhatsappHandoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly entitlements: EntitlementsService,
  ) {}

  shape(handoff: object) {
    return serializeDates(handoff);
  }

  async list(accountId: string, status?: string) {
    const where: { accountId: string; status?: string } = { accountId };
    if (status === 'open' || status === 'resolved') {
      where.status = status;
    }
    const rows = await this.prisma.whatsappHandoff.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.shape(r));
  }

  async getSettings(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { whatsappHandoffThreshold: true },
    });
    return {
      threshold: this.normalizeThreshold(account?.whatsappHandoffThreshold),
      allowed: [...HANDOFF_THRESHOLDS],
    };
  }

  async updateSettings(accountId: string, threshold: number) {
    const next = this.normalizeThreshold(threshold);
    if (!HANDOFF_THRESHOLDS.includes(next as HandoffThreshold)) {
      throw new BadRequestException({
        error: 'Limite inválido. Use 1, 2, 3 ou 5.',
      });
    }
    await this.prisma.account.update({
      where: { id: accountId },
      data: { whatsappHandoffThreshold: next },
    });
    return { threshold: next, allowed: [...HANDOFF_THRESHOLDS] };
  }

  normalizeThreshold(value: number | null | undefined): number {
    const n = Number(value);
    if (HANDOFF_THRESHOLDS.includes(n as HandoffThreshold)) return n;
    return 2;
  }

  async resolveManual(accountId: string, handoffId: string) {
    const existing = await this.prisma.whatsappHandoff.findFirst({
      where: { id: handoffId, accountId },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Atendimento não encontrado.' });
    }
    if (existing.status === 'resolved') {
      return this.shape(existing);
    }
    const updated = await this.prisma.whatsappHandoff.update({
      where: { id: existing.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    const shaped = this.shape(updated);
    this.realtime.broadcast(accountId, 'whatsapp-handoff:resolved', {
      handoff: shaped,
    });
    return shaped;
  }

  async resetUnresolved(
    accountId: string,
    phoneRaw: string,
    opts?: { party?: HandoffParty; employeeId?: string },
  ) {
    const phone = normalizePhone(phoneRaw) || phoneRaw.replace(/\D/g, '');
    if (!phone) return;

    if (opts?.party === 'employee' && opts.employeeId) {
      await this.prisma.employee.updateMany({
        where: { id: opts.employeeId, accountId },
        data: { botUnresolvedCount: 0 },
      });
      return;
    }

    await this.prisma.client.updateMany({
      where: { accountId, phone },
      data: { botUnresolvedCount: 0 },
    });
  }

  /**
   * Incrementa falhas consecutivas. Retorna o novo contador e se atingiu o limite.
   */
  async bumpUnresolved(opts: {
    accountId: string;
    phone: string;
    displayName?: string;
    party?: HandoffParty;
    employeeId?: string;
  }): Promise<{ count: number; threshold: number; reached: boolean }> {
    const phone =
      normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
    if (!phone) {
      return { count: 0, threshold: 2, reached: false };
    }

    const settings = await this.getSettings(opts.accountId);
    const threshold = settings.threshold;

    if (opts.party === 'employee' && opts.employeeId) {
      const employee = await this.prisma.employee.update({
        where: { id: opts.employeeId },
        data: { botUnresolvedCount: { increment: 1 } },
      });
      return {
        count: employee.botUnresolvedCount,
        threshold,
        reached: employee.botUnresolvedCount >= threshold,
      };
    }

    const client = await this.prisma.client.upsert({
      where: {
        accountId_phone: { accountId: opts.accountId, phone },
      },
      create: {
        accountId: opts.accountId,
        phone,
        name: opts.displayName || `Cliente WhatsApp ${phone.slice(-4)}`,
        botUnresolvedCount: 1,
      },
      update: {
        botUnresolvedCount: { increment: 1 },
        ...(opts.displayName ? { name: opts.displayName } : {}),
      },
    });

    return {
      count: client.botUnresolvedCount,
      threshold,
      reached: client.botUnresolvedCount >= threshold,
    };
  }

  /**
   * Abre ou atualiza um único alerta aberto por telefone.
   * @returns `{ handoff, created }` — created=true se acabou de abrir.
   */
  async openOrRefresh(opts: {
    accountId: string;
    phone: string;
    displayName?: string;
    lastMessage: string;
    reason: HandoffReason;
    party?: HandoffParty;
    employeeId?: string;
  }) {
    const ents = await this.entitlements.forAccount(opts.accountId);
    if (!hasFeature(ents, 'handoffs')) return null;

    const phone =
      normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
    if (!phone) return null;

    const party: HandoffParty =
      opts.party === 'employee' && opts.employeeId ? 'employee' : 'client';

    let clientId: string | null = null;
    let employeeId: string | null = null;
    let customerName =
      opts.displayName ||
      (party === 'employee'
        ? `Profissional ${phone.slice(-4)}`
        : `Cliente WhatsApp ${phone.slice(-4)}`);

    if (party === 'employee' && opts.employeeId) {
      employeeId = opts.employeeId;
      const employee = await this.prisma.employee.findFirst({
        where: { id: opts.employeeId, accountId: opts.accountId },
        select: { id: true, name: true },
      });
      if (employee) {
        customerName = opts.displayName || employee.name;
      }
    } else {
      const client = await this.prisma.client.upsert({
        where: {
          accountId_phone: { accountId: opts.accountId, phone },
        },
        create: {
          accountId: opts.accountId,
          phone,
          name: customerName,
        },
        update: opts.displayName ? { name: opts.displayName } : {},
      });
      clientId = client.id;
      customerName = client.name;
    }

    const open = await this.prisma.whatsappHandoff.findFirst({
      where: {
        accountId: opts.accountId,
        customerPhone: phone,
        status: 'open',
      },
      orderBy: { openedAt: 'desc' },
    });

    if (open) {
      const updated = await this.prisma.whatsappHandoff.update({
        where: { id: open.id },
        data: {
          lastMessage: opts.lastMessage.slice(0, 500),
          reason: opts.reason,
          customerName,
          party,
          clientId,
          employeeId,
        },
      });
      const shaped = this.shape(updated);
      this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:updated', {
        handoff: shaped,
      });
      return { handoff: shaped, created: false };
    }

    const created = await this.prisma.whatsappHandoff.create({
      data: {
        accountId: opts.accountId,
        clientId,
        employeeId,
        party,
        customerPhone: phone,
        customerName,
        lastMessage: opts.lastMessage.slice(0, 500),
        reason: opts.reason,
        status: 'open',
      },
    });
    const shaped = this.shape(created);
    this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:opened', {
      handoff: shaped,
    });
    return { handoff: shaped, created: true };
  }

  /**
   * Humano respondeu no WhatsApp: resolve alertas abertos.
   * Cliente: pausa bot 1h. Profissional: só resolve (não silencia o bot do prof).
   */
  async onHumanReply(opts: {
    accountId: string;
    phone: string;
    displayName?: string;
    party?: HandoffParty;
    employeeId?: string;
  }) {
    const phone =
      normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
    if (!phone) return { pausedUntil: null as Date | null, resolved: [] };

    const party: HandoffParty =
      opts.party === 'employee' && opts.employeeId ? 'employee' : 'client';
    const now = new Date();

    if (party === 'employee' && opts.employeeId) {
      await this.prisma.employee.updateMany({
        where: { id: opts.employeeId, accountId: opts.accountId },
        data: { botUnresolvedCount: 0 },
      });

      const open = await this.prisma.whatsappHandoff.findMany({
        where: {
          accountId: opts.accountId,
          customerPhone: phone,
          status: 'open',
        },
      });

      const resolved = [];
      for (const row of open) {
        const updated = await this.prisma.whatsappHandoff.update({
          where: { id: row.id },
          data: {
            status: 'resolved',
            humanRepliedAt: now,
            resolvedAt: now,
            party: 'employee',
            employeeId: opts.employeeId,
            clientId: null,
            ...(opts.displayName ? { customerName: opts.displayName } : {}),
          },
        });
        const shaped = this.shape(updated);
        resolved.push(shaped);
        this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:resolved', {
          handoff: shaped,
        });
      }

      return { pausedUntil: null as Date | null, resolved };
    }

    const pausedUntil = new Date(Date.now() + HUMAN_PAUSE_MS);

    const client = await this.prisma.client.upsert({
      where: {
        accountId_phone: { accountId: opts.accountId, phone },
      },
      create: {
        accountId: opts.accountId,
        phone,
        name: opts.displayName || `Cliente WhatsApp ${phone.slice(-4)}`,
        botPausedUntil: pausedUntil,
        botPausedPermanent: false,
        botUnresolvedCount: 0,
      },
      update: {
        botPausedUntil: pausedUntil,
        botPausedPermanent: false,
        botUnresolvedCount: 0,
        ...(opts.displayName ? { name: opts.displayName } : {}),
      },
    });

    const open = await this.prisma.whatsappHandoff.findMany({
      where: {
        accountId: opts.accountId,
        customerPhone: phone,
        status: 'open',
      },
    });

    const resolved = [];
    for (const row of open) {
      const updated = await this.prisma.whatsappHandoff.update({
        where: { id: row.id },
        data: {
          status: 'resolved',
          humanRepliedAt: now,
          resolvedAt: now,
          clientId: client.id,
          customerName: client.name,
          party: 'client',
          employeeId: null,
        },
      });
      const shaped = this.shape(updated);
      resolved.push(shaped);
      this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:resolved', {
        handoff: shaped,
      });
    }

    return { pausedUntil, resolved, client: this.shape(client) };
  }
}
