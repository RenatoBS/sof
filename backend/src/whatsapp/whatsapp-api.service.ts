import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

type RawBodyRequest = Request & { rawBody?: Buffer };

@Injectable()
export class WhatsappApiService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    const token = this.config.get<string>('whatsapp.token') || '';
    const phone = this.config.get<string>('whatsapp.phoneNumberId') || '';
    return Boolean(token && phone);
  }

  async sendText(to: string, body: string) {
    if (!this.isConfigured()) {
      console.warn(
        '[whatsapp] Envio ignorado — WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados.',
      );
      return null;
    }

    const phoneNumberId = this.config.getOrThrow<string>(
      'whatsapp.phoneNumberId',
    );
    const token = this.config.getOrThrow<string>('whatsapp.token');

    const resp = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `WhatsApp Cloud API recusou o envio (${resp.status}): ${text}`,
      );
    }
    return resp.json();
  }

  verifySignature(req: RawBodyRequest) {
    const appSecret = this.config.get<string>('whatsapp.appSecret') || '';
    if (!appSecret) return { valid: true, skipped: true };
    const header = req.headers['x-hub-signature-256'];
    if (!header || !req.rawBody) return { valid: false, skipped: false };

    const expected = `sha256=${createHmac('sha256', appSecret)
      .update(req.rawBody)
      .digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(String(header));
    const valid = a.length === b.length && timingSafeEqual(a, b);
    return { valid, skipped: false };
  }
}
