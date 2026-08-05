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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.guard';
import { serializeDates } from '../common/public-shapes';
import {
  normalizeProductImages,
  parseProductImagesInput,
} from './product-images';

@Controller('api/products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  private shape(product: {
    id: string;
    accountId: string;
    name: string;
    description: string;
    price: number;
    images: unknown;
    stock: number | null;
    paymentLinkUrl: string;
    handoffEnabled: boolean;
    active: boolean;
    createdAt: Date;
  }) {
    return serializeDates({
      ...product,
      images: normalizeProductImages(product.images),
    });
  }

  private parsePaymentLinkUrl(value: unknown): string {
    if (value === undefined || value === null) return '';
    const raw = String(value).trim();
    if (!raw) return '';
    if (raw.length > 2000) {
      throw new BadRequestException({
        error: 'Link de pagamento muito longo (máx. 2000 caracteres).',
      });
    }
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new BadRequestException({
        error: 'Informe um link válido (https://…).',
      });
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException({
        error: 'O link de pagamento deve começar com http:// ou https://.',
      });
    }
    return parsed.toString();
  }

  private parsePayload(body: {
    name?: string;
    description?: string;
    price?: number;
    images?: unknown;
    stock?: number | null;
    paymentLinkUrl?: string;
    handoffEnabled?: boolean;
    active?: boolean;
  }) {
    const name = String(body?.name || '').trim();
    const description = String(body?.description ?? '').trim().slice(0, 4000);
    const price = parseFloat(String(body?.price));

    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome do produto.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException({ error: 'Preço inválido.' });
    }

    const imagesParsed = parseProductImagesInput(body?.images ?? []);
    if ('error' in imagesParsed) {
      throw new BadRequestException({ error: imagesParsed.error });
    }

    let stock: number | null = null;
    if (body?.stock !== undefined && body?.stock !== null && String(body.stock) !== '') {
      const n = parseInt(String(body.stock), 10);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException({ error: 'Estoque inválido.' });
      }
      stock = n;
    }

    const paymentLinkUrl = this.parsePaymentLinkUrl(body?.paymentLinkUrl);

    return {
      name,
      description,
      price,
      images: imagesParsed.images as Prisma.InputJsonValue,
      stock,
      paymentLinkUrl,
      handoffEnabled: Boolean(body?.handoffEnabled),
      active: body?.active === undefined ? true : Boolean(body.active),
    };
  }

  @Get()
  async list(@Req() req: AuthedRequest) {
    const products = await this.prisma.product.findMany({
      where: { accountId: req.account.id },
      orderBy: { createdAt: 'asc' },
    });
    return { products: products.map((p) => this.shape(p)) };
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      name?: string;
      description?: string;
      price?: number;
      images?: unknown;
      stock?: number | null;
      paymentLinkUrl?: string;
      handoffEnabled?: boolean;
      active?: boolean;
    },
  ) {
    const data = this.parsePayload(body);
    const product = await this.prisma.product.create({
      data: {
        accountId: req.account.id,
        ...data,
      },
    });
    // Primeiro produto: liga o bot de produtos se ainda estiver desligado.
    if (!req.account.botAttendsProducts) {
      await this.prisma.account.update({
        where: { id: req.account.id },
        data: { botAttendsProducts: true },
      });
    }
    return { product: this.shape(product) };
  }

  @Put(':productId')
  async update(
    @Req() req: AuthedRequest,
    @Param('productId') productId: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      price?: number;
      images?: unknown;
      stock?: number | null;
      paymentLinkUrl?: string;
      handoffEnabled?: boolean;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, accountId: req.account.id },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Produto não encontrado.' });
    }

    const data = this.parsePayload({
      ...body,
      images: body.images !== undefined ? body.images : existing.images,
      paymentLinkUrl:
        body.paymentLinkUrl !== undefined
          ? body.paymentLinkUrl
          : existing.paymentLinkUrl,
      handoffEnabled:
        body.handoffEnabled !== undefined
          ? body.handoffEnabled
          : existing.handoffEnabled,
      active: body.active !== undefined ? body.active : existing.active,
      stock: body.stock !== undefined ? body.stock : existing.stock,
    });
    const product = await this.prisma.product.update({
      where: { id: existing.id },
      data,
    });
    return { product: this.shape(product) };
  }

  @Delete(':productId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('productId') productId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, accountId: req.account.id },
    });
    if (!product) {
      throw new NotFoundException({ error: 'Produto não encontrado.' });
    }
    await this.prisma.product.delete({ where: { id: product.id } });
    return { ok: true };
  }
}
