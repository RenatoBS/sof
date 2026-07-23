import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  TenantAuthGuard,
  type TenantAuthedRequest,
} from './tenant-auth.guard';
import {
  isTicketStatus,
  publicComment,
  publicTicket,
  ticketDetailInclude,
  ticketListInclude,
} from './ticket-shapes';

@Controller('api/tickets')
@UseGuards(TenantAuthGuard)
export class SupportTicketsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: TenantAuthedRequest,
    @Query('status') status?: string,
  ) {
    const where: { accountId: string; status?: string } = {
      accountId: req.account.id,
    };
    if (isTicketStatus(status)) where.status = status;

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      include: ticketListInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return { tickets: tickets.map(publicTicket) };
  }

  @Post()
  async create(
    @Req() req: TenantAuthedRequest,
    @Body() body: { title?: string; description?: string },
  ) {
    if (req.actor.role !== 'account') {
      throw new BadRequestException({
        error: 'Apenas a conta do estabelecimento pode abrir tickets.',
      });
    }
    const title = String(body?.title || '').trim();
    const description = String(body?.description || '').trim();
    if (!title || title.length > 160) {
      throw new BadRequestException({
        error: 'Informe um título (até 160 caracteres).',
      });
    }
    if (!description || description.length > 5000) {
      throw new BadRequestException({
        error: 'Informe uma descrição (até 5000 caracteres).',
      });
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        accountId: req.account.id,
        title,
        description,
        status: 'open',
        createdByRole: 'account',
        createdByEmployeeId: null,
      },
      include: ticketDetailInclude,
    });

    return { ticket: publicTicket(ticket) };
  }

  @Get(':id')
  async get(@Req() req: TenantAuthedRequest, @Param('id') id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, accountId: req.account.id },
      include: ticketDetailInclude,
    });
    if (!ticket) {
      throw new NotFoundException({ error: 'Ticket não encontrado.' });
    }
    return { ticket: publicTicket(ticket) };
  }

  @Post(':id/comments')
  async comment(
    @Req() req: TenantAuthedRequest,
    @Param('id') id: string,
    @Body() body: { body?: string },
  ) {
    const text = String(body?.body || '').trim();
    if (!text || text.length > 5000) {
      throw new BadRequestException({
        error: 'Informe um comentário (até 5000 caracteres).',
      });
    }

    const existing = await this.prisma.supportTicket.findFirst({
      where: { id, accountId: req.account.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Ticket não encontrado.' });
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.supportTicketComment.create({
        data: {
          ticketId: id,
          body: text,
          authorRole: req.actor.role,
          authorEmployeeId:
            req.actor.role === 'employee' ? req.actor.employeeId : null,
        },
        include: {
          authorEmployee: { select: { id: true, name: true } },
          authorAdmin: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return { comment: publicComment(comment) };
  }

  @Patch(':id/status')
  async updateStatus(
    @Req() req: TenantAuthedRequest,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    if (!isTicketStatus(body?.status)) {
      throw new BadRequestException({
        error: 'Status inválido. Use open, in_progress, resolved ou closed.',
      });
    }

    const existing = await this.prisma.supportTicket.findFirst({
      where: { id, accountId: req.account.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Ticket não encontrado.' });
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status: body.status },
      include: ticketDetailInclude,
    });

    return { ticket: publicTicket(ticket) };
  }
}
