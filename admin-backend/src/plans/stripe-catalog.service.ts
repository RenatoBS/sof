import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

function stripeErrorMessage(err: unknown): string {
  if (err instanceof Stripe.errors.StripeError) {
    return err.message || `Stripe: ${err.type}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Falha ao comunicar com a Stripe.';
}

function isStripeMissing(err: unknown) {
  return (
    err instanceof Stripe.errors.StripeInvalidRequestError &&
    err.code === 'resource_missing'
  );
}

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

  private rethrowStripe(err: unknown): never {
    throw new BadGatewayException({ error: stripeErrorMessage(err) });
  }

  async createPaymentLink(priceId: string) {
    const stripe = this.requireClient();
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: priceId, quantity: 1 }],
    });
    if (!link.url) {
      throw new ServiceUnavailableException({
        error: 'Stripe criou o Payment Link sem URL.',
      });
    }
    return { paymentLinkId: link.id, paymentLinkUrl: link.url };
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
    const link = await this.createPaymentLink(price.id);
    return {
      stripeProductId: product.id,
      stripePriceId: price.id,
      paymentLinkUrl: link.paymentLinkUrl,
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

  /**
   * Remove catálogo na Stripe o máximo possível:
   * - Payment Links não têm DELETE → desativa (`active: false`)
   * - Prices só arquivam
   * - Product: tenta `del`; se a Stripe recusar (ex.: tem prices), arquiva
   * Qualquer erro da Stripe sobe para o front (não apaga o plano local).
   */
  async deleteCatalogResources(input: {
    productId: string;
    priceId?: string;
    paymentLinkUrl?: string;
  }) {
    const stripe = this.requireClient();
    const productId = input.productId.trim();
    const priceIds = new Set<string>();
    if (input.priceId?.startsWith('price_')) {
      priceIds.add(input.priceId);
    }

    try {
      if (productId.startsWith('prod_')) {
        const prices = await stripe.prices.list({
          product: productId,
          limit: 100,
        });
        for (const price of prices.data) {
          priceIds.add(price.id);
        }
      }

      const paymentLinkUrl = String(input.paymentLinkUrl || '').trim();
      for await (const link of stripe.paymentLinks.list({
        limit: 100,
        active: true,
      })) {
        let matches = paymentLinkUrl !== '' && link.url === paymentLinkUrl;
        if (!matches && priceIds.size > 0) {
          const items = await stripe.paymentLinks.listLineItems(link.id, {
            limit: 20,
          });
          matches = items.data.some((li) => {
            const id =
              typeof li.price === 'string' ? li.price : li.price?.id || '';
            return Boolean(id && priceIds.has(id));
          });
        }
        if (matches) {
          await stripe.paymentLinks.update(link.id, { active: false });
        }
      }

      for (const priceId of priceIds) {
        try {
          await stripe.prices.update(priceId, { active: false });
        } catch (err) {
          if (!isStripeMissing(err)) throw err;
        }
      }

      if (!productId.startsWith('prod_')) return;

      try {
        await stripe.products.del(productId);
      } catch (err) {
        if (isStripeMissing(err)) return;
        // Produto com Price associado não pode ser deletado — arquiva.
        try {
          await stripe.products.update(productId, { active: false });
        } catch (archiveErr) {
          if (!isStripeMissing(archiveErr)) throw archiveErr;
        }
      }
    } catch (err) {
      if (
        err instanceof BadGatewayException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      this.rethrowStripe(err);
    }
  }
}
