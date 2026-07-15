import {
  Controller,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { MercadoPagoService } from '../checkout/mercadopago.service';
import { ProvisionService } from '../checkout/provision.service';

@Controller('api/payments')
export class PaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly provision: ProvisionService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query() query: Record<string, string>,
  ) {
    const body = req.body as {
      type?: string;
      data?: { id?: string | number };
    };
    const type = body?.type || query.type;
    const paymentId = String(body?.data?.id || query['data.id'] || '');

    if (type !== 'payment' || !paymentId) {
      return;
    }

    const { valid, skipped } = this.mercadoPago.verifyWebhookSignature(
      req,
      paymentId,
    );
    if (!valid) {
      console.warn(
        '[webhook] Assinatura do Mercado Pago inválida, ignorando notificação.',
      );
      throw new UnauthorizedException();
    }
    if (skipped) {
      console.warn(
        '[webhook] MP_WEBHOOK_SECRET não configurado — assinatura não verificada.',
      );
    }

    if (!this.mercadoPago.isConfigured()) {
      return;
    }

    try {
      const payment = await this.mercadoPago.getPayment(paymentId);
      if (payment.status === 'approved' && payment.external_reference) {
        const session = await this.prisma.checkoutSession.findUnique({
          where: { id: payment.external_reference },
        });
        if (session && session.status === 'pending') {
          await this.provision.provisionAccount(session);
        }
      }
    } catch (err) {
      console.error(
        '[webhook] Erro ao processar notificação do Mercado Pago:',
        (err as Error).message,
      );
    }
  }
}
