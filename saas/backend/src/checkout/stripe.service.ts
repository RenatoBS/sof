import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private client: Stripe | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('stripe.secretKey'));
  }

  private getStripe(): Stripe {
    if (!this.client) {
      const secretKey = this.config.getOrThrow<string>('stripe.secretKey');
      this.client = new Stripe(secretKey);
    }
    return this.client;
  }

  async createCheckoutSession({
    sessionId,
    planName,
    stripePriceId,
    payerEmail,
  }: {
    sessionId: string;
    planName: string;
    stripePriceId: string;
    payerEmail: string;
  }) {
    const publicUrl = this.config.getOrThrow<string>('publicUrl');
    const stripe = this.getStripe();
    const integrationSuffix = randomBytes(4).toString('hex');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: payerEmail,
      client_reference_id: sessionId,
      success_url: `${publicUrl}/checkout-return?ref=${sessionId}`,
      cancel_url: `${publicUrl}/checkout-return?ref=${sessionId}`,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata: {
        checkoutSessionId: sessionId,
        planName,
      },
      subscription_data: {
        metadata: {
          checkoutSessionId: sessionId,
          planName,
        },
      },
      integration_identifier: `sof-checkout-${integrationSuffix}`,
    });

    if (!session.url) {
      throw new Error('Stripe não retornou URL de checkout.');
    }

    return { id: session.id, url: session.url };
  }

  constructEvent(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.getOrThrow<string>(
      'stripe.webhookSecret',
    );
    return this.getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  }
}
