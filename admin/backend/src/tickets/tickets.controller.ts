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
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminAuthGuard,
  type AuthedAdminRequest,
} from '../auth/admin-auth.guard';

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

function isTicketStatus(
  value: unknown,
): value is (typeof TICKET_STATUSES)[number] {
  return (
    typeof value === 'string' &&
    (TICKET_STATUSES as readonly string[]).includes(value)
  );
}

const commentInclude = {
  authorEmployee: { select: { id: true, name: true } },
  authorAdmin: { select: { id: true, name: true, email: true } },
} as const;

const listInclude = {
  createdByEmployee: { select: { id: true, name: true } },
  account: { select: { id: true, businessName: true, email: true } },
  _count: { select: { comments: true } },
} as const;

const detailInclude = {
  createdByEmployee: { select: { id: true, name: true } },
  account: { select: { id: true, businessName: true, email: true } },
  comments: {
    include: commentInclude,
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

function publicComment(comment: {
  id: string;
  body: string;
  authorRole: string;
  authorEmployeeId: string | null;
  authorAdminId: string | null;
  createdAt: Date;
  authorEmployee?: { id: string; name: string } | null;
  authorAdmin?: { id: string; name: string; email: string } | null;
}) {
  let authorName = 'Conta';
  if (comment.authorRole === 'employee') {
    authorName = comment.authorEmployee?.name || 'Profissional';
  } else if (comment.authorRole === 'admin') {
    authorName = comment.authorAdmin?.name || 'Sof';
  }
  return {
    id: comment.id,
    body: comment.body,
    authorRole: comment.authorRole,
    authorName,
    authorEmployeeId: comment.authorEmployeeId,
    authorAdminId: comment.authorAdminId,
    createdAt: comment.createdAt.toISOString(),
  };
}

function publicTicket(ticket: {
  id: string;
  accountId: string;
  title: string;
  description: string;
  status: string;
  createdByRole: string;
  createdByEmployeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByEmployee?: { id: string; name: string } | null;
  account?: { id: string; businessName: string; email: string };
  comments?: Parameters<typeof publicComment>[0][];
  _count?: { comments: number };
}) {
  return {
    id: ticket.id,
    accountId: ticket.accountId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    createdByRole: ticket.createdByRole,
    createdByEmployeeId: ticket.createdByEmployeeId,
    createdByName:
      ticket.createdByRole === 'employee'
        ? ticket.createdByEmployee?.name || 'Profissional'
        : ticket.account?.businessName || 'Conta',
    account: ticket.account
      ? {
          id: ticket.account.id,
          businessName: ticket.account.businessName,
          email: ticket.account.email,
        }
      : undefined,
    commentCount: ticket._count?.comments ?? ticket.comments?.length ?? 0,
    comments: ticket.comments?.map(publicComment),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

@Controller('api/tickets')
@UseGuards(AdminAuthGuard)
export class TicketsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const limit = Math.min(
      Math.max(parseInt(limitRaw || '50', 10) || 50, 1),
      100,
    );
    const offset = Math.max(parseInt(offsetRaw || '0', 10) || 0, 0);
    const where: Prisma.SupportTicketWhereInput = {};
    if (isTicketStatus(status)) {
      where.status = status;
    } else if (!status || status === 'openish') {
      // default: tickets ainda ativos
      where.status = { in: ['open', 'in_progress'] };
    } else if (status === 'all') {
      // no filter
    }

    const query = String(q || '').trim();
    if (query) {
      where.OR = [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        {
          account: {
            OR: [
              { businessName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [total, tickets] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return { total, tickets: tickets.map(publicTicket) };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: detailInclude,
    });
    if (!ticket) {
      throw new NotFoundException({ error: 'Ticket não encontrado.' });
    }
    return { ticket: publicTicket(ticket) };
  }

  @Post(':id/comments')
  async comment(
    @Req() req: AuthedAdminRequest,
    @Param('id') id: string,
    @Body() body: { body?: string },
  ) {
    const text = String(body?.body || '').trim();
    if (!text || text.length > 5000) {
      throw new BadRequestException({
        error: 'Informe um comentário (até 5000 caracteres).',
      });
    }

    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Ticket não encontrado.' });
    }

    const [comment] = await this.prisma.$transaction([
      this.prisma.supportTicketComment.create({
        data: {
          ticketId: id,
          body: text,
          authorRole: 'admin',
          authorAdminId: req.admin.id,
        },
        include: commentInclude,
      }),
      this.prisma.supportTicket.update({
        where: { id },
        data: {
          updatedAt: new Date(),
          status:
            existing.status === 'open' ? 'in_progress' : existing.status,
        },
      }),
    ]);

    return { comment: publicComment(comment) };
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    if (!isTicketStatus(body?.status)) {
      throw new BadRequestException({
        error: 'Status inválido. Use open, in_progress, resolved ou closed.',
      });
    }

    const existing = await this.prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Ticket não encontrado.' });
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id },
      data: { status: body.status },
      include: detailInclude,
    });

    return { ticket: publicTicket(ticket) };
  }
}
