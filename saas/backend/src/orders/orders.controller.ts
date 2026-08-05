import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import { normalizeProductImages } from '../products/product-images';

const ORDER_STATUSES = new Set([
  'pending',
  'confirmed',
  'cancelled',
  'completed',
]);

@Controller('api/orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  private shape(
    order: {
      id: string;
      accountId: string;
      clientId: string | null;
      clientName: string;
      clientPhone: string;
      status: string;
      total: number;
      source: string;
      notes: string;
      createdAt: Date;
      updatedAt: Date;
      items?: Array<{
        id: string;
        orderId: string;
        productId: string;
        productName: string;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
        product?: { images: unknown } | null;
      }>;
    },
  ) {
    return serializeDates({
      ...order,
      items: (order.items || []).map((item) =>
        serializeDates({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          productImage: normalizeProductImages(item.product?.images)[0] || '',
        }),
      ),
    });
  }

  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
  ) {
    const where: { accountId: string; status?: string } = {
      accountId: req.account.id,
    };
    if (status && ORDER_STATUSES.has(status)) {
      where.status = status;
    }
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        items: {
          include: { product: { select: { images: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { orders: orders.map((o) => this.shape(o)) };
  }

  @Patch(':orderId/status')
  async updateStatus(
    @Req() req: AuthedRequest,
    @Param('orderId') orderId: string,
    @Body() body: { status?: string },
  ) {
    const status = String(body?.status || '').trim();
    if (!ORDER_STATUSES.has(status)) {
      throw new BadRequestException({
        error:
          'Status inválido. Use: pending, confirmed, cancelled ou completed.',
      });
    }

    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, accountId: req.account.id },
      include: {
        items: {
          include: { product: { select: { images: true } } },
        },
      },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Pedido não encontrado.' });
    }

    const order = await this.prisma.order.update({
      where: { id: existing.id },
      data: { status },
      include: {
        items: {
          include: { product: { select: { images: true } } },
        },
      },
    });
    return { order: this.shape(order) };
  }
}
