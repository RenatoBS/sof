import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

type RawBodyRequest = Request & { rawBody?: Buffer };
export type WhatsappProvider = 'meta' | 'uazapi';

@Injectable()
export class WhatsappApiService {
  constructor(private readonly config: ConfigService) {}

  provider(): WhatsappProvider {
    const raw = (this.config.get<string>('whatsapp.provider') || 'meta')
      .trim()
      .toLowerCase();
    return raw === 'uazapi' || raw === 'whazap' ? 'uazapi' : 'meta';
  }

  isConfigured() {
    const token = this.config.get<string>('whatsapp.token') || '';
    if (this.provider() === 'uazapi') {
      const baseUrl = this.config.get<string>('whatsapp.baseUrl') || '';
      return Boolean(token && baseUrl);
    }
    const phone = this.config.get<string>('whatsapp.phoneNumberId') || '';
    return Boolean(token && phone);
  }

  /** ID usado para ligar o webhook à conta (Meta phoneNumberId ou Uazapi instance id). */
  instanceKey() {
    return (this.config.get<string>('whatsapp.phoneNumberId') || '').trim();
  }

  async sendText(to: string, body: string) {
    if (!this.isConfigured()) {
      console.warn(
        '[whatsapp] Envio ignorado — credenciais WhatsApp não configuradas.',
      );
      return null;
    }

    const digits = String(to).replace(/\D/g, '');
    if (this.provider() === 'uazapi') {
      return this.sendTextUazapi(digits, body);
    }
    return this.sendTextMeta(digits, body);
  }

  private async sendTextUazapi(to: string, body: string) {
    const baseUrl = (
      this.config.getOrThrow<string>('whatsapp.baseUrl') || ''
    ).replace(/\/+$/, '');
    const token = this.config.getOrThrow<string>('whatsapp.token');

    const resp = await fetch(`${baseUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify({ number: to, text: body }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Whazap/Uazapi recusou o envio (${resp.status}): ${text}`,
      );
    }
    return resp.json();
  }

  private async sendTextMeta(to: string, body: string) {
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

  /**
   * Configura o webhook na instância Uazapi apontando para a API Sof.
   * Só faz sentido com WHATSAPP_PROVIDER=uazapi e URL pública HTTPS.
   */
  async configureUazapiWebhook(callbackUrl: string) {
    if (this.provider() !== 'uazapi' || !this.isConfigured()) {
      throw new Error('Whazap/Uazapi não está configurado.');
    }
    const baseUrl = (
      this.config.getOrThrow<string>('whatsapp.baseUrl') || ''
    ).replace(/\/+$/, '');
    const token = this.config.getOrThrow<string>('whatsapp.token');

    const resp = await fetch(`${baseUrl}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify({
        url: callbackUrl,
        enabled: true,
        events: ['messages'],
        excludeMessages: ['wasSentByApi', 'fromMe', 'isGroupYes'],
        addUrlEvents: false,
        addUrlTypesMessages: false,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `Falha ao configurar webhook Uazapi (${resp.status}): ${text}`,
      );
    }
    return resp.json().catch(() => ({}));
  }

  verifySignature(req: RawBodyRequest) {
    if (this.provider() === 'uazapi') {
      // Uazapi não envia assinatura HMAC no webhook por padrão.
      return { valid: true, skipped: true as const };
    }

    const appSecret = this.config.get<string>('whatsapp.appSecret') || '';
    if (!appSecret) return { valid: true, skipped: true as const };
    const header = req.headers['x-hub-signature-256'];
    if (!header || !req.rawBody) return { valid: false, skipped: false as const };

    const expected = `sha256=${createHmac('sha256', appSecret)
      .update(req.rawBody)
      .digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(String(header));
    const valid = a.length === b.length && timingSafeEqual(a, b);
    return { valid, skipped: false as const };
  }
}
