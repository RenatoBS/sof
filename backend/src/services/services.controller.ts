import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
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

    const service = await this.prisma.service.create({
      data: {
        accountId: req.account.id,
        name,
        duration,
        price,
      },
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
