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

@Controller('api/services')
@UseGuards(AuthGuard)
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  private parsePayload(body: {
    name?: string;
    duration?: number;
    price?: number;
  }) {
    const name = String(body?.name || '').trim();
    const duration = parseInt(String(body?.duration), 10);
    const price = parseFloat(String(body?.price));

    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome do serviço.' });
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new BadRequestException({ error: 'Duração inválida.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException({ error: 'Preço inválido.' });
    }

    return { name, duration, price };
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    const services = await this.prisma.service.findMany({
      where: { accountId: req.account.id },
      orderBy: { createdAt: 'asc' },
    });
    return { services: services.map((s) => serializeDates(s)) };
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; duration?: number; price?: number },
  ) {
    const data = this.parsePayload(body);
    const service = await this.prisma.service.create({
      data: {
        accountId: req.account.id,
        ...data,
      },
    });
    return { service: serializeDates(service) };
  }

  @Put(':serviceId')
  async update(
    @Req() req: AuthedRequest,
    @Param('serviceId') serviceId: string,
    @Body() body: { name?: string; duration?: number; price?: number },
  ) {
    const existing = await this.prisma.service.findFirst({
      where: { id: serviceId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Serviço não encontrado.' });
    }

    const data = this.parsePayload(body);
    const service = await this.prisma.service.update({
      where: { id: existing.id },
      data,
    });
    return { service: serializeDates(service) };
  }

  @Delete(':serviceId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('serviceId') serviceId: string,
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, accountId: req.account.id },
    });
    if (!service) {
      throw new NotFoundException({ error: 'Serviço não encontrado.' });
    }
    await this.prisma.service.delete({ where: { id: service.id } });
    return { ok: true };
  }
}
