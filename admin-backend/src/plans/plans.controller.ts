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
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import { publicPlan, slugifyPlanName } from '../common/public-shapes';
import { PrismaService } from '../prisma/prisma.service';
import { StripeCatalogService } from './stripe-catalog.service';

@Controller('api/plans')
@UseGuards(AdminAuthGuard)
export class PlansController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeCatalogService,
  ) {}

  @Get()
  async list() {
    const plans = await this.prisma.plan.findMany({
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
    return {
      plans: plans.map(publicPlan),
      stripeConfigured: this.stripe.isConfigured(),
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException({ error: 'Plano não encontrado.' });
    return { plan: publicPlan(plan) };
  }

  @Post()
  async create(
    @Body()
    body: {
      name?: string;
      price?: number;
      interval?: string;
      features?: string[];
      sortOrder?: number;
      active?: boolean;
      paymentLinkUrl?: string;
      /** Se true e Stripe configurado, cria Product+Price+Payment Link na Stripe */
      syncStripe?: boolean;
      stripeProductId?: string;
      stripePriceId?: string;
    },
  ) {
    const name = String(body?.name || '').trim();
    const price = Number(body?.price);
    const interval =
      body?.interval === 'year' ? ('year' as const) : ('month' as const);
    const features = Array.isArray(body?.features)
      ? body.features.filter((f): f is string => typeof f === 'string')
      : [];
    const sortOrder =
      body?.sortOrder === undefined ? 0 : Number(body.sortOrder) || 0;
    const active = body?.active !== false;
    const paymentLinkUrl = String(body?.paymentLinkUrl || '').trim();

    if (!name) {
      throw new BadRequestException({ error: 'Informe o nome do plano.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new BadRequestException({ error: 'Informe um preço válido.' });
    }

    const slug = slugifyPlanName(name);
    if (!slug) {
      throw new BadRequestException({ error: 'Nome de plano inválido.' });
    }

    const clash = await this.prisma.plan.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (clash) {
      throw new BadRequestException({ error: 'Já existe um plano com esse nome.' });
    }

    let stripeProductId = String(body?.stripeProductId || '').trim();
    let stripePriceId = String(body?.stripePriceId || '').trim();
    let resolvedPaymentLinkUrl = paymentLinkUrl;
    const syncStripe = body?.syncStripe !== false;

    if (syncStripe && this.stripe.isConfigured()) {
      const created = await this.stripe.createProductAndPrice({
        name,
        priceBrl: price,
        interval,
      });
      stripeProductId = created.stripeProductId;
      stripePriceId = created.stripePriceId;
      if (!resolvedPaymentLinkUrl) {
        resolvedPaymentLinkUrl = created.paymentLinkUrl;
      }
    } else if (!stripeProductId || !stripePriceId) {
      if (!this.stripe.isConfigured()) {
        throw new BadRequestException({
          error:
            'Sem Stripe: informe stripeProductId e stripePriceId, ou configure STRIPE_SECRET_KEY.',
        });
      }
    }

    const plan = await this.prisma.plan.create({
      data: {
        name,
        slug,
        price,
        interval,
        stripeProductId,
        stripePriceId,
        paymentLinkUrl: resolvedPaymentLinkUrl,
        features,
        active,
        sortOrder,
      },
    });

    return { plan: publicPlan(plan) };
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      price?: number;
      interval?: string;
      features?: string[];
      sortOrder?: number;
      active?: boolean;
      paymentLinkUrl?: string;
      syncStripe?: boolean;
    },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException({ error: 'Plano não encontrado.' });

    const syncStripe = body?.syncStripe !== false;
    const data: Prisma.PlanUpdateInput = {};
    const canSyncStripe =
      syncStripe &&
      this.stripe.isConfigured() &&
      plan.stripeProductId.startsWith('prod_');

    let nextName = plan.name;
    if (body.name !== undefined) {
      nextName = String(body.name).trim();
      if (!nextName) {
        throw new BadRequestException({ error: 'Nome inválido.' });
      }
      const slug = slugifyPlanName(nextName);
      const clash = await this.prisma.plan.findFirst({
        where: {
          OR: [{ name: nextName }, { slug }],
          NOT: { id },
        },
      });
      if (clash) {
        throw new BadRequestException({
          error: 'Já existe um plano com esse nome.',
        });
      }
      data.name = nextName;
      data.slug = slug;
      if (canSyncStripe) {
        await this.stripe.updateProductName(plan.stripeProductId, nextName);
      }
    }

    if (body.features !== undefined) {
      data.features = Array.isArray(body.features)
        ? body.features.filter((f): f is string => typeof f === 'string')
        : [];
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Number(body.sortOrder) || 0;
    }
    if (body.paymentLinkUrl !== undefined) {
      data.paymentLinkUrl = String(body.paymentLinkUrl).trim();
    }

    const nextInterval =
      body.interval === 'year'
        ? 'year'
        : body.interval === 'month'
          ? 'month'
          : plan.interval === 'year'
            ? 'year'
            : 'month';
    if (body.interval !== undefined) {
      data.interval = nextInterval;
    }

    const priceChanged =
      body.price !== undefined && Number(body.price) !== plan.price;
    const intervalChanged =
      body.interval !== undefined && nextInterval !== plan.interval;

    if (priceChanged || intervalChanged) {
      const nextPrice = priceChanged ? Number(body.price) : plan.price;
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        throw new BadRequestException({ error: 'Preço inválido.' });
      }
      data.price = nextPrice;

      if (canSyncStripe) {
        const replaced = await this.stripe.createReplacementPrice({
          productId: plan.stripeProductId,
          planName: nextName,
          priceBrl: nextPrice,
          interval: nextInterval,
          previousPriceId: plan.stripePriceId.startsWith('price_')
            ? plan.stripePriceId
            : undefined,
        });
        data.stripePriceId = replaced.stripePriceId;
        // Novo Price exige novo Payment Link; só sobrescreve se o admin não
        // enviou paymentLinkUrl neste mesmo request.
        if (body.paymentLinkUrl === undefined) {
          const link = await this.stripe.createPaymentLink(replaced.stripePriceId);
          data.paymentLinkUrl = link.paymentLinkUrl;
        }
      }
    }

    if (body.active !== undefined) {
      data.active = Boolean(body.active);
      if (canSyncStripe) {
        await this.stripe.setProductActive(
          plan.stripeProductId,
          Boolean(body.active),
        );
      }
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data,
    });
    return { plan: publicPlan(updated) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException({ error: 'Plano não encontrado.' });

    const hasStripeProduct = plan.stripeProductId.startsWith('prod_');
    const hasStripePrice = plan.stripePriceId.startsWith('price_');
    const hasPaymentLink = Boolean(plan.paymentLinkUrl?.trim());
    const needsStripeCleanup =
      hasStripeProduct || hasStripePrice || hasPaymentLink;

    if (needsStripeCleanup) {
      if (!this.stripe.isConfigured()) {
        throw new BadRequestException({
          error:
            'Este plano tem recursos na Stripe. Configure STRIPE_SECRET_KEY para apagá-los via API.',
        });
      }
      await this.stripe.deleteCatalogResources({
        productId: plan.stripeProductId,
        priceId: plan.stripePriceId,
        paymentLinkUrl: plan.paymentLinkUrl,
      });
    }

    await this.prisma.plan.delete({ where: { id } });
    return { ok: true };
  }
}
