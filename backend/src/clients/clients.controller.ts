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
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import { isValidPhone, normalizePhone } from '../common/phone';

@Controller('api/clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(private readonly prisma: PrismaService) {}

  private async parsePayload(
    accountId: string,
    body: { name?: string; phone?: string },
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

  @Get()
  async list(@Req() req: AuthedRequest) {
    const clients = await this.prisma.client.findMany({
      where: { accountId: req.account.id },
      orderBy: { name: 'asc' },
    });
    return { clients: clients.map((c) => serializeDates(c)) };
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; phone?: string },
  ) {
    const data = await this.parsePayload(req.account.id, body);
    const client = await this.prisma.client.create({
      data: {
        accountId: req.account.id,
        ...data,
      },
    });
    return { client: serializeDates(client) };
  }

  @Put(':clientId')
  async update(
    @Req() req: AuthedRequest,
    @Param('clientId') clientId: string,
    @Body() body: { name?: string; phone?: string },
  ) {
    const existing = await this.prisma.client.findFirst({
      where: { id: clientId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Cliente não encontrado.' });
    }

    const data = await this.parsePayload(req.account.id, body, existing.id);
    const client = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.client.update({
        where: { id: existing.id },
        data,
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
  async remove(
    @Req() req: AuthedRequest,
    @Param('clientId') clientId: string,
  ) {
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
