import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const API_BASE = 'https://api.mercadopago.com';

@Injectable()
export class MercadoPagoService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('mercadoPago.accessToken'));
  }

  private apiPublicUrl() {
    return (
      process.env.API_PUBLIC_URL ||
      `http://localhost:${this.config.get<number>('port') || 3001}`
    ).replace(/\/+$/, '');
  }

  async createPreference({
    sessionId,
    planName,
    price,
    payerEmail,
  }: {
    sessionId: string;
    planName: string;
    price: number;
    payerEmail: string;
  }) {
    const publicUrl = this.config.getOrThrow<string>('publicUrl');
    const accessToken = this.config.getOrThrow<string>(
      'mercadoPago.accessToken',
    );

    const body = {
      items: [
        {
          id: `plan-${planName}`,
          title: `Assinatura Soft — Plano ${planName}`,
          description: 'Assinatura mensal do painel de agendamentos Soft.',
          quantity: 1,
          currency_id: 'BRL',
          unit_price: price,
        },
      ],
      payer: { email: payerEmail },
      external_reference: sessionId,
      back_urls: {
        success: `${publicUrl}/checkout-retorno.html?ref=${sessionId}`,
        pending: `${publicUrl}/checkout-retorno.html?ref=${sessionId}`,
        failure: `${publicUrl}/checkout-retorno.html?ref=${sessionId}`,
      },
      auto_return: 'approved',
      notification_url: `${this.apiPublicUrl()}/api/payments/webhook`,
      statement_descriptor: 'SOFT AGENDAMENTO',
    };

    const resp = await fetch(`${API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Mercado Pago recusou a criação da preferência (${resp.status}): ${text}`,
      );
    }

    return resp.json() as Promise<{
      id: string;
      init_point: string;
      sandbox_init_point?: string;
    }>;
  }

  async getPayment(paymentId: string) {
    const accessToken = this.config.getOrThrow<string>(
      'mercadoPago.accessToken',
    );
    const resp = await fetch(
      `${API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Falha ao consultar pagamento no Mercado Pago (${resp.status}): ${text}`,
      );
    }
    return resp.json() as Promise<{
      status: string;
      external_reference?: string;
    }>;
  }

  verifyWebhookSignature(req: Request, resourceId: string) {
    const webhookSecret =
      this.config.get<string>('mercadoPago.webhookSecret') || '';
    if (!webhookSecret) {
      return { valid: true, skipped: true };
    }
    const signatureHeader = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];
    if (!signatureHeader) return { valid: false, skipped: false };

    const parts = Object.fromEntries(
      String(signatureHeader)
        .split(',')
        .map((piece) => piece.trim().split('=').map((s) => s.trim()))
        .filter((pair) => pair.length === 2),
    );
    const { ts, v1 } = parts;
    if (!ts || !v1) return { valid: false, skipped: false };

    const manifest = `id:${resourceId};request-id:${requestId || ''};ts:${ts};`;
    const expected = createHmac('sha256', webhookSecret)
      .update(manifest)
      .digest('hex');

    const valid =
      expected.length === v1.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    return { valid, skipped: false };
  }
}
