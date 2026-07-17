import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../checkout/stripe.service';
import { ProvisionService } from '../checkout/provision.service';

type RequestWithRawBody = Request & { rawBody?: Buffer };

@Controller('api/payments')
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly provision: ProvisionService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: RequestWithRawBody,
    @Headers('stripe-signature') signature: string | undefined,
  ) {
    if (!this.stripe.isConfigured()) {
      return { received: true };
    }

    if (!signature || !req.rawBody) {
      throw new BadRequestException({
        error: 'Webhook Stripe inválido (assinatura ou corpo ausente).',
      });
    }

    let event;
    try {
      event = this.stripe.constructEvent(req.rawBody, signature);
    } catch (err) {
      console.warn(
        '[webhook] Assinatura Stripe inválida:',
        (err as Error).message,
      );
      throw new UnauthorizedException();
    }

    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object;
      const sofSessionId =
        checkoutSession.client_reference_id ||
        checkoutSession.metadata?.checkoutSessionId ||
        '';

      if (
        (checkoutSession.payment_status === 'paid' ||
          checkoutSession.payment_status === 'no_payment_required') &&
        sofSessionId
      ) {
        try {
          const session = await this.prisma.checkoutSession.findUnique({
            where: { id: sofSessionId },
          });
          if (session && session.status === 'pending') {
            await this.provision.provisionAccount(session);
          }
        } catch (err) {
          console.error(
            '[webhook] Erro ao provisionar após checkout Stripe:',
            (err as Error).message,
          );
        }
      }
    }

    return { received: true };
  }
}
