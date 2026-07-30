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
import {
  defaultsForPlanSlug,
  sanitizeEntitlementsInput,
} from '../common/feature-catalog';
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
      include: { _count: { select: { accounts: true } } },
    });
    return {
      plans: plans.map(publicPlan),
      stripeConfigured: this.stripe.isConfigured(),
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { accounts: true } } },
    });
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
      entitlements?: Record<string, unknown>;
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
      const created = await this.stripe.syncPlanCatalog({
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

    const entitlements = sanitizeEntitlementsInput(
      body?.entitlements ?? defaultsForPlanSlug(slug),
    );

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
        entitlements: entitlements as Prisma.InputJsonValue,
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
      entitlements?: Record<string, unknown>;
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
    }

    if (body.features !== undefined) {
      data.features = Array.isArray(body.features)
        ? body.features.filter((f): f is string => typeof f === 'string')
        : [];
    }
    if (body.entitlements !== undefined) {
      data.entitlements = sanitizeEntitlementsInput(
        body.entitlements,
      ) as Prisma.InputJsonValue;
    }
    if (body.sortOrder !== undefined) {
      data.sortOrder = Number(body.sortOrder) || 0;
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
    const nameChanged = body.name !== undefined && nextName !== plan.name;

    if (priceChanged) {
      const nextPrice = Number(body.price);
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        throw new BadRequestException({ error: 'Preço inválido.' });
      }
      data.price = nextPrice;
    }

    const nextPrice = priceChanged ? Number(body.price) : plan.price;

    // Override manual só se o admin mandou uma URL *diferente* da atual.
    const incomingLink =
      body.paymentLinkUrl !== undefined
        ? String(body.paymentLinkUrl).trim()
        : undefined;
    const manualLinkOverride =
      incomingLink !== undefined && incomingLink !== plan.paymentLinkUrl;

    const needsStripeSync =
      syncStripe &&
      this.stripe.isConfigured() &&
      (priceChanged ||
        intervalChanged ||
        nameChanged ||
        !plan.stripeProductId.startsWith('prod_') ||
        !plan.stripePriceId.startsWith('price_') ||
        !plan.paymentLinkUrl.trim());

    if (needsStripeSync) {
      const synced = await this.stripe.syncPlanCatalog({
        name: nextName,
        priceBrl: nextPrice,
        interval: nextInterval,
        existingProductId: plan.stripeProductId,
        existingPriceId: plan.stripePriceId,
        existingPaymentLinkUrl: plan.paymentLinkUrl,
      });
      data.stripeProductId = synced.stripeProductId;
      data.stripePriceId = synced.stripePriceId;
      if (!manualLinkOverride) {
        data.paymentLinkUrl = synced.paymentLinkUrl;
      }
    } else if (manualLinkOverride) {
      data.paymentLinkUrl = incomingLink;
    }

    if (body.active !== undefined) {
      data.active = Boolean(body.active);
      const productId =
        typeof data.stripeProductId === 'string'
          ? data.stripeProductId
          : plan.stripeProductId;
      if (syncStripe && this.stripe.isConfigured() && productId.startsWith('prod_')) {
        await this.stripe.setProductActive(productId, Boolean(body.active));
      }
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data,
    });
    return { plan: publicPlan(updated) };
  }

  /** Força Product + Price + Payment Link alinhados ao preço do Sof. */
  @Post(':id/sync-stripe')
  async syncStripe(@Param('id') id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException({ error: 'Plano não encontrado.' });
    if (!this.stripe.isConfigured()) {
      throw new BadRequestException({
        error: 'Configure STRIPE_SECRET_KEY no admin-backend.',
      });
    }

    const interval = plan.interval === 'year' ? 'year' : 'month';
    const synced = await this.stripe.syncPlanCatalog({
      name: plan.name,
      priceBrl: plan.price,
      interval,
      existingProductId: plan.stripeProductId,
      existingPriceId: plan.stripePriceId,
      existingPaymentLinkUrl: plan.paymentLinkUrl,
    });

    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        stripeProductId: synced.stripeProductId,
        stripePriceId: synced.stripePriceId,
        paymentLinkUrl: synced.paymentLinkUrl,
      },
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
