import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeCatalogService {
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('stripe.secretKey') || '';
    if (key) {
      this.client = new Stripe(key);
    }
  }

  isConfigured() {
    return Boolean(this.client);
  }

  private requireClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException({
        error:
          'Stripe não configurado. Defina STRIPE_SECRET_KEY no admin-backend.',
      });
    }
    return this.client;
  }

  async createProductAndPrice(input: {
    name: string;
    priceBrl: number;
    interval: 'month' | 'year';
  }) {
    const stripe = this.requireClient();
    const product = await stripe.products.create({
      name: `Sof — ${input.name}`,
      metadata: { sof_plan: input.name },
    });
    const unitAmount = Math.round(input.priceBrl * 100);
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: unitAmount,
      currency: 'brl',
      recurring: { interval: input.interval },
      metadata: { sof_plan: input.name },
    });
    return {
      stripeProductId: product.id,
      stripePriceId: price.id,
    };
  }

  async updateProductName(productId: string, name: string) {
    const stripe = this.requireClient();
    await stripe.products.update(productId, {
      name: `Sof — ${name}`,
      metadata: { sof_plan: name },
    });
  }

  /** Prices são imutáveis — cria um novo Price e arquiva o anterior. */
  async createReplacementPrice(input: {
    productId: string;
    planName: string;
    priceBrl: number;
    interval: 'month' | 'year';
    previousPriceId?: string;
  }) {
    const stripe = this.requireClient();
    const unitAmount = Math.round(input.priceBrl * 100);
    const price = await stripe.prices.create({
      product: input.productId,
      unit_amount: unitAmount,
      currency: 'brl',
      recurring: { interval: input.interval },
      metadata: { sof_plan: input.planName },
    });
    if (input.previousPriceId) {
      try {
        await stripe.prices.update(input.previousPriceId, { active: false });
      } catch (err) {
        console.warn('[stripe] Não foi possível arquivar price anterior:', err);
      }
    }
    return { stripePriceId: price.id };
  }

  async setProductActive(productId: string, active: boolean) {
    const stripe = this.requireClient();
    await stripe.products.update(productId, { active });
  }
}
