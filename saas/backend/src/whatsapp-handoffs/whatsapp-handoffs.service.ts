import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../events/realtime.service';
import { serializeDates } from '../common/public-shapes';
import { normalizePhone } from '../common/phone';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { hasFeature } from '../entitlements/feature-catalog';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';

export const HANDOFF_THRESHOLDS = [1, 2, 3, 5] as const;
export type HandoffThreshold = (typeof HANDOFF_THRESHOLDS)[number];

export type HandoffReason = 'unresolved' | 'human_requested' | 'product_sale';
export type HandoffParty = 'client' | 'employee';
export type HandoffAssigneeType = 'account' | 'employee';
export type MessageSenderKind =
  | 'client'
  | 'employee_party'
  | 'bot'
  | 'human_wa'
  | 'agent';

const HUMAN_PAUSE_MS = 60 * 60 * 1000;

type Actor =
  | { kind: 'account' }
  | { kind: 'employee'; employeeId: string };

@Injectable()
export class WhatsappHandoffsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    private readonly entitlements: EntitlementsService,
    @Inject(forwardRef(() => WhatsappApiService))
    private readonly whatsappApi: WhatsappApiService,
  ) {}

  shape(handoff: object) {
    return serializeDates(handoff);
  }

  shapeMessage(message: object) {
    return serializeDates(message);
  }

  async list(
    accountId: string,
    status?: string,
    opts?: { party?: HandoffParty; forEmployeeId?: string },
  ) {
    const where: {
      accountId: string;
      status?: string;
      party?: string;
    } = { accountId };
    if (status === 'open' || status === 'resolved') {
      where.status = status;
    }
    if (opts?.party) {
      where.party = opts.party;
    }
    const rows = await this.prisma.whatsappHandoff.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 100,
    });
    // Profissionais só veem fila livre + os que estão com eles.
    if (opts?.forEmployeeId) {
      return rows
        .filter(
          (r) =>
            r.status === 'resolved' ||
            !r.assigneeType ||
            (r.assigneeType === 'employee' &&
              r.assignedEmployeeId === opts.forEmployeeId),
        )
        .map((r) => this.shape(r));
    }
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

  async findOpenByPhone(accountId: string, phoneRaw: string) {
    const phone = normalizePhone(phoneRaw) || phoneRaw.replace(/\D/g, '');
    if (!phone) return null;
    return this.prisma.whatsappHandoff.findFirst({
      where: { accountId, customerPhone: phone, status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
  }

  async listMessages(accountId: string, handoffId: string) {
    const handoff = await this.requireHandoff(accountId, handoffId);
    const rows = await this.prisma.whatsappMessage.findMany({
      where: { handoffId: handoff.id },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return rows.map((r) => this.shapeMessage(r));
  }

  /**
   * Persiste mensagem na thread de um handoff aberto (ou pelo id).
   * Dedupa por providerMessageId quando informado.
   */
  async appendMessage(opts: {
    accountId: string;
    handoffId?: string;
    phone?: string;
    direction: 'inbound' | 'outbound';
    senderKind: MessageSenderKind;
    body: string;
    providerMessageId?: string;
    agentEmployeeId?: string | null;
    sentByAccountOwner?: boolean;
    updateLastMessage?: boolean;
  }) {
    const body = String(opts.body || '').trim();
    if (!body) return null;

    if (opts.providerMessageId) {
      const dup = await this.prisma.whatsappMessage.findFirst({
        where: {
          accountId: opts.accountId,
          providerMessageId: opts.providerMessageId,
        },
      });
      if (dup) return this.shapeMessage(dup);
    }

    let handoff = opts.handoffId
      ? await this.prisma.whatsappHandoff.findFirst({
          where: { id: opts.handoffId, accountId: opts.accountId },
        })
      : null;

    if (!handoff && opts.phone) {
      handoff = await this.findOpenByPhone(opts.accountId, opts.phone);
    }
    if (!handoff) return null;

    const message = await this.prisma.whatsappMessage.create({
      data: {
        accountId: opts.accountId,
        handoffId: handoff.id,
        customerPhone: handoff.customerPhone,
        direction: opts.direction,
        senderKind: opts.senderKind,
        body: body.slice(0, 4000),
        providerMessageId: opts.providerMessageId || null,
        agentEmployeeId: opts.agentEmployeeId || null,
        sentByAccountOwner: Boolean(opts.sentByAccountOwner),
      },
    });

    if (opts.updateLastMessage !== false) {
      const updated = await this.prisma.whatsappHandoff.update({
        where: { id: handoff.id },
        data: { lastMessage: body.slice(0, 500) },
      });
      this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:updated', {
        handoff: this.shape(updated),
      });
    }

    const shaped = this.shapeMessage(message);
    this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:message', {
      handoffId: handoff.id,
      message: shaped,
    });
    return shaped;
  }

  /** Seed da thread com lastMessage se ainda não houver mensagens. */
  private async seedInitialMessage(handoff: {
    id: string;
    accountId: string;
    customerPhone: string;
    lastMessage: string;
    party: string;
  }) {
    const body = String(handoff.lastMessage || '').trim();
    if (!body) return;
    const count = await this.prisma.whatsappMessage.count({
      where: { handoffId: handoff.id },
    });
    if (count > 0) return;
    await this.appendMessage({
      accountId: handoff.accountId,
      handoffId: handoff.id,
      phone: handoff.customerPhone,
      direction: 'inbound',
      senderKind: handoff.party === 'employee' ? 'employee_party' : 'client',
      body,
      updateLastMessage: false,
    });
  }

  async resolveManual(accountId: string, handoffId: string, actor?: Actor) {
    const existing = await this.requireHandoff(accountId, handoffId);
    if (actor) this.assertCanActOn(existing, actor, { allowUnassigned: true });
    if (existing.status === 'resolved') {
      return this.shape(existing);
    }
    const updated = await this.prisma.whatsappHandoff.update({
      where: { id: existing.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    // Resolver (ou Devolver à Sof) devolve o bot: limpa pausa automática do cliente.
    if (existing.party === 'client') {
      await this.resumeAutoPausedClient(accountId, existing.customerPhone);
    }
    const shaped = this.shape(updated);
    this.realtime.broadcast(accountId, 'whatsapp-handoff:resolved', {
      handoff: shaped,
    });
    return shaped;
  }

  /** Resolve e devolve o bot (pausa automática já limpa em `resolveManual`). */
  async returnToSof(accountId: string, handoffId: string, actor?: Actor) {
    return this.resolveManual(accountId, handoffId, actor);
  }

  async claim(accountId: string, handoffId: string, actor: Actor) {
    const existing = await this.requireHandoff(accountId, handoffId);
    if (existing.status !== 'open') {
      throw new BadRequestException({ error: 'Atendimento já resolvido.' });
    }
    if (actor.kind === 'employee') {
      if (existing.party !== 'client') {
        throw new ForbiddenException({
          error: 'Profissionais só atendem conversas de clientes.',
        });
      }
      await this.assertEmployeeCanHandle(accountId, actor.employeeId);
      if (
        existing.assigneeType &&
        !(
          existing.assigneeType === 'employee' &&
          existing.assignedEmployeeId === actor.employeeId
        )
      ) {
        throw new BadRequestException({
          error: 'Atendimento já atribuído a outra pessoa.',
        });
      }
    } else if (
      existing.assigneeType &&
      existing.assigneeType !== 'account'
    ) {
      throw new BadRequestException({
        error: 'Atendimento já atribuído a um profissional. Transfira ou liberte primeiro.',
      });
    }

    const now = new Date();
    const updated = await this.prisma.whatsappHandoff.update({
      where: { id: existing.id },
      data:
        actor.kind === 'account'
          ? {
              assigneeType: 'account',
              assignedEmployeeId: null,
              assignedAt: now,
            }
          : {
              assigneeType: 'employee',
              assignedEmployeeId: actor.employeeId,
              assignedAt: now,
            },
    });
    const shaped = this.shape(updated);
    this.realtime.broadcast(accountId, 'whatsapp-handoff:updated', {
      handoff: shaped,
    });
    return shaped;
  }

  async transfer(
    accountId: string,
    handoffId: string,
    body: { assigneeType?: string; employeeId?: string },
    actor: Actor,
  ) {
    const existing = await this.requireHandoff(accountId, handoffId);
    if (existing.status !== 'open') {
      throw new BadRequestException({ error: 'Atendimento já resolvido.' });
    }
    this.assertCanActOn(existing, actor, { allowUnassigned: actor.kind === 'account' });

    const assigneeType = String(body?.assigneeType || '').trim();
    if (assigneeType !== 'account' && assigneeType !== 'employee') {
      throw new BadRequestException({
        error: 'Informe assigneeType: account ou employee.',
      });
    }

    if (assigneeType === 'employee') {
      if (existing.party !== 'client') {
        throw new BadRequestException({
          error: 'Só conversas de clientes podem ir para profissionais.',
        });
      }
      const employeeId = String(body?.employeeId || '').trim();
      if (!employeeId) {
        throw new BadRequestException({ error: 'Informe o profissional.' });
      }
      await this.assertEmployeeCanHandle(accountId, employeeId);
      const updated = await this.prisma.whatsappHandoff.update({
        where: { id: existing.id },
        data: {
          assigneeType: 'employee',
          assignedEmployeeId: employeeId,
          assignedAt: new Date(),
        },
      });
      const shaped = this.shape(updated);
      this.realtime.broadcast(accountId, 'whatsapp-handoff:updated', {
        handoff: shaped,
      });
      return shaped;
    }

    const updated = await this.prisma.whatsappHandoff.update({
      where: { id: existing.id },
      data: {
        assigneeType: 'account',
        assignedEmployeeId: null,
        assignedAt: new Date(),
      },
    });
    const shaped = this.shape(updated);
    this.realtime.broadcast(accountId, 'whatsapp-handoff:updated', {
      handoff: shaped,
    });
    return shaped;
  }

  async release(accountId: string, handoffId: string, actor: Actor) {
    const existing = await this.requireHandoff(accountId, handoffId);
    if (existing.status !== 'open') {
      throw new BadRequestException({ error: 'Atendimento já resolvido.' });
    }
    this.assertCanActOn(existing, actor, { allowUnassigned: false });

    const updated = await this.prisma.whatsappHandoff.update({
      where: { id: existing.id },
      data: {
        assigneeType: null,
        assignedEmployeeId: null,
        assignedAt: null,
      },
    });
    const shaped = this.shape(updated);
    this.realtime.broadcast(accountId, 'whatsapp-handoff:updated', {
      handoff: shaped,
    });
    return shaped;
  }

  async reply(
    accountId: string,
    handoffId: string,
    textRaw: string,
    actor: Actor,
  ) {
    const text = String(textRaw || '').trim();
    if (!text) {
      throw new BadRequestException({ error: 'Informe a mensagem.' });
    }
    if (text.length > 4000) {
      throw new BadRequestException({ error: 'Mensagem muito longa.' });
    }

    const existing = await this.requireHandoff(accountId, handoffId);
    if (existing.status !== 'open') {
      throw new BadRequestException({ error: 'Atendimento já resolvido.' });
    }

    // Auto-claim se ainda na fila e o ator pode assumir.
    if (!existing.assigneeType) {
      await this.claim(accountId, handoffId, actor);
    } else {
      this.assertCanActOn(existing, actor, { allowUnassigned: false });
    }

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { whatsappInstanceToken: true },
    });

    // Envio best-effort: inbox grava mesmo se a sessão WA estiver caída (dev/e2e).
    let delivered = true;
    try {
      await this.whatsappApi.sendText(
        existing.customerPhone,
        text,
        account?.whatsappInstanceToken || undefined,
      );
    } catch (err) {
      delivered = false;
      console.warn(
        '[whatsapp-handoffs] Falha ao enviar reply via WhatsApp:',
        err instanceof Error ? err.message : err,
      );
    }

    const now = new Date();
    await this.prisma.whatsappHandoff.update({
      where: { id: existing.id },
      data: { humanRepliedAt: now },
    });

    if (existing.party === 'client') {
      await this.pauseClientBot({
        accountId,
        phone: existing.customerPhone,
        displayName: existing.customerName,
      });
    }

    const message = await this.appendMessage({
      accountId,
      handoffId: existing.id,
      direction: 'outbound',
      senderKind: 'agent',
      body: text,
      agentEmployeeId: actor.kind === 'employee' ? actor.employeeId : null,
      sentByAccountOwner: actor.kind === 'account',
    });

    const handoff = await this.prisma.whatsappHandoff.findUnique({
      where: { id: existing.id },
    });
    return {
      handoff: handoff ? this.shape(handoff) : null,
      message,
      delivered,
    };
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
    const phone = normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
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

    const phone = normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
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
      await this.appendMessage({
        accountId: opts.accountId,
        handoffId: updated.id,
        direction: 'inbound',
        senderKind: party === 'employee' ? 'employee_party' : 'client',
        body: opts.lastMessage,
        updateLastMessage: false,
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
    await this.seedInitialMessage(created);
    const shaped = this.shape(created);
    this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:opened', {
      handoff: shaped,
    });
    return { handoff: shaped, created: true };
  }

  /**
   * Silencia o bot para este cliente por 1h e zera o contador de falhas.
   */
  async pauseClientBot(opts: {
    accountId: string;
    phone: string;
    displayName?: string;
  }) {
    const phone = normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
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
        botPausedAuto: true,
        botUnresolvedCount: 0,
      },
      update: {
        botPausedUntil: pausedUntil,
        botPausedPermanent: false,
        botPausedAuto: true,
        botUnresolvedCount: 0,
        ...(opts.displayName ? { name: opts.displayName } : {}),
      },
    });

    this.realtime.broadcast(opts.accountId, 'client:updated', {
      client: this.shape(client),
    });
    return { client, pausedUntil };
  }

  /**
   * Cliente chamou pela Sof durante a pausa automática: bot volta a responder.
   */
  async resumeAutoPausedClient(accountId: string, rawPhone: string) {
    const phone = normalizePhone(rawPhone) || rawPhone.replace(/\D/g, '');
    if (!phone) return false;

    const updated = await this.prisma.client.updateMany({
      where: {
        accountId,
        phone,
        botPausedAuto: true,
        botPausedPermanent: false,
      },
      data: {
        botPausedUntil: null,
        botPausedAuto: false,
        botUnresolvedCount: 0,
      },
    });
    if (updated.count === 0) return false;

    const client = await this.prisma.client.findUnique({
      where: { accountId_phone: { accountId, phone } },
    });
    if (client) {
      this.realtime.broadcast(accountId, 'client:updated', {
        client: this.shape(client),
      });
    }
    return true;
  }

  /**
   * Humano respondeu no WhatsApp (celular/Web): pausa bot, marca humanRepliedAt,
   * persiste na thread — NÃO resolve (fechamento é explícito no inbox).
   */
  async onHumanReply(opts: {
    accountId: string;
    phone: string;
    displayName?: string;
    party?: HandoffParty;
    employeeId?: string;
    messageBody?: string;
    providerMessageId?: string;
  }) {
    const phone = normalizePhone(opts.phone) || opts.phone.replace(/\D/g, '');
    if (!phone) return { pausedUntil: null as Date | null, handoffs: [] };

    const party: HandoffParty =
      opts.party === 'employee' && opts.employeeId ? 'employee' : 'client';
    const now = new Date();

    if (party === 'employee' && opts.employeeId) {
      await this.prisma.employee.updateMany({
        where: { id: opts.employeeId, accountId: opts.accountId },
        data: { botUnresolvedCount: 0 },
      });
    } else {
      await this.pauseClientBot({
        accountId: opts.accountId,
        phone,
        displayName: opts.displayName,
      });
    }

    const open = await this.prisma.whatsappHandoff.findMany({
      where: {
        accountId: opts.accountId,
        customerPhone: phone,
        status: 'open',
      },
    });

    const handoffs = [];
    for (const row of open) {
      const updated = await this.prisma.whatsappHandoff.update({
        where: { id: row.id },
        data: {
          humanRepliedAt: now,
          ...(opts.displayName ? { customerName: opts.displayName } : {}),
        },
      });
      if (opts.messageBody) {
        await this.appendMessage({
          accountId: opts.accountId,
          handoffId: row.id,
          direction: 'outbound',
          senderKind: 'human_wa',
          body: opts.messageBody,
          providerMessageId: opts.providerMessageId,
          updateLastMessage: true,
        });
      }
      const shaped = this.shape(updated);
      handoffs.push(shaped);
      this.realtime.broadcast(opts.accountId, 'whatsapp-handoff:updated', {
        handoff: shaped,
      });
    }

    return { pausedUntil: party === 'client' ? now : null, handoffs };
  }

  private async requireHandoff(accountId: string, handoffId: string) {
    const existing = await this.prisma.whatsappHandoff.findFirst({
      where: { id: handoffId, accountId },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Atendimento não encontrado.' });
    }
    return existing;
  }

  private async assertEmployeeCanHandle(
    accountId: string,
    employeeId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, accountId },
      select: { id: true, canHandleHandoffs: true },
    });
    if (!employee) {
      throw new NotFoundException({ error: 'Profissional não encontrado.' });
    }
    if (!employee.canHandleHandoffs) {
      throw new ForbiddenException({
        error: 'Este profissional não está habilitado para atendimentos.',
      });
    }
    return employee;
  }

  private assertCanActOn(
    handoff: {
      assigneeType: string | null;
      assignedEmployeeId: string | null;
      party: string;
    },
    actor: Actor,
    opts: { allowUnassigned: boolean },
  ) {
    if (actor.kind === 'account') return;

    if (handoff.party !== 'client') {
      throw new ForbiddenException({
        error: 'Profissionais só atendem conversas de clientes.',
      });
    }

    if (!handoff.assigneeType) {
      if (opts.allowUnassigned) return;
      throw new ForbiddenException({
        error: 'Assuma o atendimento antes de continuar.',
      });
    }

    if (
      handoff.assigneeType !== 'employee' ||
      handoff.assignedEmployeeId !== actor.employeeId
    ) {
      throw new ForbiddenException({
        error: 'Este atendimento está com outra pessoa.',
      });
    }
  }
}
