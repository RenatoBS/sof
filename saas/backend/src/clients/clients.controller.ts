import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import { isValidPhone, normalizePhone } from '../common/phone';

type ClientWriteBody = {
  name?: string;
  phone?: string;
  botPausedPermanent?: boolean;
  botPausedUntil?: string | null;
};

@Controller('api/clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private async parsePayload(
    accountId: string,
    body: ClientWriteBody,
    excludeClientId?: string,
  ) {
    const name = String(body?.name || '').trim();
    const phone = normalizePhone(body?.phone);

    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome do cliente.' });
    }
    if (!isValidPhone(phone)) {
      throw new BadRequestException({
        error: 'Informe um telefone válido com DDD (somente números).',
      });
    }

    const taken = await this.prisma.client.findUnique({
      where: {
        accountId_phone: { accountId, phone },
      },
    });
    if (taken && taken.id !== excludeClientId) {
      throw new BadRequestException({
        error: 'Já existe um cliente com este telefone.',
      });
    }

    return { name, phone };
  }

  /**
   * Pausa definida pelo dono. Sempre grava `botPausedAuto: false` — assim o
   * cliente chamando pela Sof no WhatsApp não desfaz o que o dono decidiu.
   */
  private parseBotPause(body: ClientWriteBody): {
    botPausedPermanent: boolean;
    botPausedUntil: Date | null;
    botPausedAuto: boolean;
  } {
    const permanent = Boolean(body.botPausedPermanent);
    if (permanent) {
      return {
        botPausedPermanent: true,
        botPausedUntil: null,
        botPausedAuto: false,
      };
    }

    if (body.botPausedUntil === null || body.botPausedUntil === '') {
      return {
        botPausedPermanent: false,
        botPausedUntil: null,
        botPausedAuto: false,
      };
    }

    if (body.botPausedUntil === undefined) {
      // Campo omitido no create — defaults
      return {
        botPausedPermanent: false,
        botPausedUntil: null,
        botPausedAuto: false,
      };
    }

    const until = new Date(String(body.botPausedUntil));
    if (Number.isNaN(until.getTime())) {
      throw new BadRequestException({
        error: 'Data de pausa do bot inválida.',
      });
    }
    if (until.getTime() <= Date.now()) {
      throw new BadRequestException({
        error: 'A pausa temporária precisa ser uma data/hora no futuro.',
      });
    }
    return {
      botPausedPermanent: false,
      botPausedUntil: until,
      botPausedAuto: false,
    };
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    const clients = await this.prisma.client.findMany({
      where: { accountId: req.account.id },
      orderBy: { name: 'asc' },
    });
    return { clients: clients.map((c) => serializeDates(c)) };
  }

  @Post()
  async create(@Req() req: AuthedRequest, @Body() body: ClientWriteBody) {
    const data = await this.parsePayload(req.account.id, body);
    const pause = this.parseBotPause(body);
    if (pause.botPausedPermanent || pause.botPausedUntil != null) {
      await this.entitlements.assertFeature(req.account.id, 'botPause');
    }
    const client = await this.prisma.client.create({
      data: {
        accountId: req.account.id,
        ...data,
        ...pause,
      },
    });
    return { client: serializeDates(client) };
  }

  @Put(':clientId')
  async update(
    @Req() req: AuthedRequest,
    @Param('clientId') clientId: string,
    @Body() body: ClientWriteBody,
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { id: clientId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Cliente não encontrado.' });
    }

    const data = await this.parsePayload(req.account.id, body, existing.id);
    const pause =
      body.botPausedPermanent !== undefined || body.botPausedUntil !== undefined
        ? this.parseBotPause(body)
        : {
            botPausedPermanent: existing.botPausedPermanent,
            botPausedUntil: existing.botPausedUntil,
            botPausedAuto: existing.botPausedAuto,
          };
    if (
      body.botPausedPermanent !== undefined ||
      body.botPausedUntil !== undefined
    ) {
      const enabling = pause.botPausedPermanent || pause.botPausedUntil != null;
      if (enabling) {
        await this.entitlements.assertFeature(req.account.id, 'botPause');
      }
    }

    const client = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: { id: existing.id },
        data: { ...data, ...pause },
      });
      await tx.appointment.updateMany({
        where: { clientId: existing.id, accountId: req.account.id },
        data: {
          clientName: data.name,
          clientPhone: data.phone,
        },
      });
      return updated;
    });
    return { client: serializeDates(client) };
  }

  @Delete(':clientId')
  async remove(@Req() req: AuthedRequest, @Param('clientId') clientId: string) {
    const existing = await this.prisma.client.findFirst({
      where: { id: clientId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Cliente não encontrado.' });
    }
    await this.prisma.client.delete({ where: { id: existing.id } });
    return { ok: true };
  }
}
