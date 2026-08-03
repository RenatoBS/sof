import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

type RawBodyRequest = Request & { rawBody?: Buffer };
export type WhatsappProvider = 'meta' | 'uazapi';

function truncateWhatsappTitle(value: string, max: number) {
  const text = String(value || '').trim();
  if (text.length <= max) return text || 'Opção';
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

export type UazapiInstanceCreated = {
  instanceId: string;
  token: string;
  name?: string;
  raw: Record<string, unknown>;
};

export type UazapiConnectResult = {
  status: string;
  qrcode?: string;
  paircode?: string;
  instanceId?: string;
  raw: Record<string, unknown>;
};

export type UazapiStatusResult = {
  status: string;
  qrcode?: string;
  paircode?: string;
  phone?: string;
  instanceId?: string;
  raw: Record<string, unknown>;
};

@Injectable()
export class WhatsappApiService {
  constructor(private readonly config: ConfigService) {}

  provider(): WhatsappProvider {
    const raw = (this.config.get<string>('whatsapp.provider') || 'uazapi')
      .trim()
      .toLowerCase();
    return raw === 'meta' ? 'meta' : 'uazapi';
  }

  /** Servidor Whazap pronto para criar/parear instâncias por conta. */
  isAdminConfigured() {
    if (this.provider() !== 'uazapi') return false;
    const baseUrl = this.config.get<string>('whatsapp.baseUrl') || '';
    const adminToken = this.config.get<string>('whatsapp.adminToken') || '';
    return Boolean(baseUrl && adminToken);
  }

  /** Token de uma instância única (legado) — envio e pareamento sem admin. */
  legacyInstanceToken() {
    if (this.provider() !== 'uazapi') return '';
    return (this.config.get<string>('whatsapp.token') || '').trim();
  }

  /** QR/código na Conta: admin (multi-tenant) ou token de instância no .env. */
  isPairingAvailable() {
    if (this.provider() !== 'uazapi') return false;
    const baseUrl = this.config.get<string>('whatsapp.baseUrl') || '';
    if (!baseUrl) return false;
    return this.isAdminConfigured() || Boolean(this.legacyInstanceToken());
  }

  /**
   * Envio possível: admin (multi-conta) OU token legado de instância única / Meta.
   */
  isConfigured() {
    if (this.provider() === 'uazapi') {
      return this.isPairingAvailable();
    }
    const token = this.config.get<string>('whatsapp.token') || '';
    const phone = this.config.get<string>('whatsapp.phoneNumberId') || '';
    return Boolean(token && phone);
  }

  /** ID legado do .env (instância única). */
  instanceKey() {
    return (this.config.get<string>('whatsapp.phoneNumberId') || '').trim();
  }

  private uazapiBaseUrl() {
    return (this.config.getOrThrow<string>('whatsapp.baseUrl') || '').replace(
      /\/+$/,
      '',
    );
  }

  private async uazapiFetch(
    path: string,
    opts: {
      method?: string;
      body?: unknown;
      auth: { kind: 'admin' } | { kind: 'token'; token: string };
    },
  ) {
    const baseUrl = this.uazapiBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (opts.auth.kind === 'admin') {
      headers.admintoken = this.config.getOrThrow<string>(
        'whatsapp.adminToken',
      );
    } else {
      headers.token = opts.auth.token;
    }

    const resp = await fetch(`${baseUrl}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await resp.text().catch(() => '');
    let json: Record<string, unknown> = {};
    if (text) {
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        json = { raw: text };
      }
    }
    if (!resp.ok) {
      throw new Error(
        `Whazap/Uazapi ${path} falhou (${resp.status}): ${text.slice(0, 400)}`,
      );
    }
    return json;
  }

  private pickString(
    obj: Record<string, unknown> | null | undefined,
    keys: string[],
  ): string {
    if (!obj) return '';
    for (const key of keys) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number') return String(value);
    }
    return '';
  }

  private nestRecord(
    raw: Record<string, unknown>,
    key: string,
  ): Record<string, unknown> | null {
    const value = raw[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private normalizeStatus(raw: string) {
    const s = raw.trim().toLowerCase();
    if (!s) return 'disconnected';
    if (s.includes('disconnect') || s === 'close' || s === 'closed') {
      return 'disconnected';
    }
    if (
      s === 'connecting' ||
      s.includes('connecting') ||
      s === 'qr' ||
      s === 'pair'
    ) {
      return 'connecting';
    }
    if (
      s === 'connected' ||
      s === 'open' ||
      s === 'authenticated' ||
      s === 'online'
    ) {
      return 'connected';
    }
    if (s === 'hibernated') return 'hibernated';
    return s;
  }

  private extractQrAndPair(raw: Record<string, unknown>) {
    const instance = this.nestRecord(raw, 'instance');
    const data = this.nestRecord(raw, 'data');
    const response = this.nestRecord(raw, 'response');
    const nests = [raw, instance, data, response].filter(
      Boolean,
    ) as Record<string, unknown>[];
    const qrKeys = [
      'qrcode',
      'qrCode',
      'qr',
      'base64',
      'qrcodeBase64',
    ] as const;
    // Não usar `code` — na Uazapi costuma ser status HTTP numérico (ex. 200/401).
    const pairKeys = [
      'paircode',
      'pairCode',
      'pairingCode',
      'pairing_code',
      'pair_code',
    ] as const;
    let qrcode = '';
    let paircode = '';
    for (const nest of nests) {
      if (!qrcode) qrcode = this.pickString(nest, [...qrKeys]);
      if (!paircode) paircode = this.pickString(nest, [...pairKeys]);
    }
    return { qrcode: qrcode || undefined, paircode: paircode || undefined };
  }

  async createInstance(name: string): Promise<UazapiInstanceCreated> {
    if (!this.isAdminConfigured()) {
      throw new Error(
        'Whazap/Uazapi admin não configurado (WHATSAPP_BASE_URL + WHATSAPP_ADMIN_TOKEN).',
      );
    }
    const raw = await this.uazapiFetch('/instance/init', {
      method: 'POST',
      auth: { kind: 'admin' },
      body: {
        name,
        systemName: 'Sof',
        adminField01: name,
      },
    });

    const instance = this.nestRecord(raw, 'instance') || raw;
    const token =
      this.pickString(instance, ['token', 'instanceToken', 'apikey', 'hash']) ||
      this.pickString(raw, ['token', 'instanceToken', 'apikey', 'hash']);
    const instanceId =
      this.pickString(instance, ['id', 'instanceId', 'instance', 'name']) ||
      this.pickString(raw, ['id', 'instanceId']);

    if (!token || !instanceId) {
      throw new Error(
        `Resposta inesperada ao criar instância Uazapi: ${JSON.stringify(raw).slice(0, 400)}`,
      );
    }

    return { instanceId, token, name, raw };
  }

  async connectInstance(
    token: string,
    phone?: string,
  ): Promise<UazapiConnectResult> {
    const digits = phone ? phone.replace(/\D/g, '') : '';
    // Pair code exige sessão limpa: se a instância já está em connecting
    // com QR (auto-refresh da Conta), a Uazapi responde 200 sem paircode.
    if (digits) {
      try {
        await this.disconnectInstance(token);
      } catch (err) {
        console.warn(
          '[whatsapp] disconnect antes do paircode:',
          err instanceof Error ? err.message : err,
        );
      }
    }

    const body: Record<string, string> = {};
    if (digits) body.phone = digits;

    const raw = await this.uazapiFetch('/instance/connect', {
      method: 'POST',
      auth: { kind: 'token', token },
      body,
    });

    const instance = this.nestRecord(raw, 'instance');
    const statusRaw =
      this.pickString(raw, ['status', 'state', 'connectionStatus']) ||
      this.pickString(instance, ['status', 'state', 'connectionStatus']) ||
      'connecting';
    const { qrcode, paircode } = this.extractQrAndPair(raw);
    const instanceId =
      this.pickString(instance, ['id', 'instanceId']) ||
      this.pickString(raw, ['id', 'instanceId']) ||
      undefined;

    if (digits && !paircode) {
      console.warn(
        '[whatsapp] connect com phone sem paircode. raw=',
        JSON.stringify(raw).slice(0, 500),
      );
    }

    return {
      status: this.normalizeStatus(statusRaw),
      qrcode,
      paircode,
      instanceId,
      raw,
    };
  }

  async instanceStatus(token: string): Promise<UazapiStatusResult> {
    const raw = await this.uazapiFetch('/instance/status', {
      method: 'GET',
      auth: { kind: 'token', token },
    });

    const instance = this.nestRecord(raw, 'instance');
    const statusRaw =
      this.pickString(raw, ['status', 'state', 'connectionStatus']) ||
      this.pickString(instance, ['status', 'state', 'connectionStatus']) ||
      'disconnected';
    const { qrcode, paircode } = this.extractQrAndPair(raw);
    const phone =
      this.pickString(raw, ['phone', 'owner', 'number', 'wid']) ||
      this.pickString(instance, ['phone', 'owner', 'number', 'wid']) ||
      undefined;
    const instanceId =
      this.pickString(instance, ['id', 'instanceId']) ||
      this.pickString(raw, ['id', 'instanceId']) ||
      undefined;

    return {
      status: this.normalizeStatus(statusRaw),
      qrcode,
      paircode,
      phone,
      instanceId,
      raw,
    };
  }

  async disconnectInstance(token: string) {
    return this.uazapiFetch('/instance/disconnect', {
      method: 'POST',
      auth: { kind: 'token', token },
      body: {},
    });
  }

  /** Transcreve áudio de mensagem via Uazapi (POST /message/download). */
  async transcribeAudio(
    messageId: string,
    instanceToken?: string,
  ): Promise<string> {
    if (this.provider() !== 'uazapi') {
      throw new Error('Transcrição de áudio só está disponível com Uazapi.');
    }
    const token =
      (instanceToken || '').trim() ||
      (this.config.get<string>('whatsapp.token') || '').trim();
    if (!token || !this.config.get<string>('whatsapp.baseUrl')) {
      throw new Error('Uazapi sem token para transcrever áudio.');
    }

    const openaiApiKey =
      (this.config.get<string>('whatsapp.openaiApiKey') || '').trim() ||
      undefined;

    const body: Record<string, unknown> = {
      id: messageId,
      transcribe: true,
      return_base64: false,
      return_link: false,
    };
    if (openaiApiKey) body.openai_apikey = openaiApiKey;

    const json = await this.uazapiFetch('/message/download', {
      method: 'POST',
      body,
      auth: { kind: 'token', token },
    });

    return String(json.transcription || '').trim();
  }

  async sendText(to: string, body: string, instanceToken?: string) {
    if (this.provider() === 'uazapi') {
      const token =
        (instanceToken || '').trim() ||
        (this.config.get<string>('whatsapp.token') || '').trim();
      if (!token || !this.config.get<string>('whatsapp.baseUrl')) {
        console.warn(
          '[whatsapp] Envio ignorado — sem token de instância nem WHATSAPP_TOKEN.',
        );
        return null;
      }
      const digits = String(to).replace(/\D/g, '');
      return this.sendTextUazapi(digits, body, token);
    }

    if (!this.isConfigured()) {
      console.warn(
        '[whatsapp] Envio ignorado — credenciais WhatsApp não configuradas.',
      );
      return null;
    }
    const digits = String(to).replace(/\D/g, '');
    return this.sendTextMeta(digits, body);
  }

  /**
   * Menu interativo: botões (≤3) ou lista (>3).
   * Fallback: se o provider falhar, o caller deve enviar texto.
   */
  async sendMenu(
    to: string,
    menu: {
      text: string;
      choices: Array<{ id: string; title: string; description?: string }>;
      listButton?: string;
      footerText?: string;
    },
    instanceToken?: string,
  ) {
    const digits = String(to).replace(/\D/g, '');
    if (this.provider() === 'uazapi') {
      const token =
        (instanceToken || '').trim() ||
        (this.config.get<string>('whatsapp.token') || '').trim();
      if (!token || !this.config.get<string>('whatsapp.baseUrl')) {
        throw new Error('Uazapi sem token para enviar menu.');
      }
      return this.sendMenuUazapi(digits, menu, token);
    }
    if (!this.isConfigured()) {
      throw new Error('WhatsApp Meta não configurado.');
    }
    return this.sendMenuMeta(digits, menu);
  }

  private async sendTextUazapi(to: string, body: string, token: string) {
    const baseUrl = this.uazapiBaseUrl();
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

  private async sendMenuUazapi(
    to: string,
    menu: {
      text: string;
      choices: Array<{ id: string; title: string; description?: string }>;
      listButton?: string;
      footerText?: string;
    },
    token: string,
  ) {
    const useButtons =
      menu.choices.length <= 3 &&
      !menu.choices.some((c) => Boolean(c.description?.trim()));
    const choices = menu.choices.map((c) => {
      const title = truncateWhatsappTitle(c.title, useButtons ? 20 : 24);
      if (useButtons) return `${title}|${c.id}`;
      const desc = (c.description || '').slice(0, 72);
      return desc ? `${title}|${c.id}|${desc}` : `${title}|${c.id}`;
    });

    const body: Record<string, unknown> = {
      number: to,
      type: useButtons ? 'button' : 'list',
      text: menu.text,
      choices,
    };
    if (menu.footerText) body.footerText = menu.footerText;
    if (!useButtons) {
      body.listButton = menu.listButton || 'Ver opções';
      body.choices = ['[Opções]', ...choices];
    }

    const baseUrl = this.uazapiBaseUrl();
    const resp = await fetch(`${baseUrl}/send/menu`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        token,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Whazap/Uazapi recusou o menu (${resp.status}): ${text}`);
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

  private async sendMenuMeta(
    to: string,
    menu: {
      text: string;
      choices: Array<{ id: string; title: string; description?: string }>;
      listButton?: string;
      footerText?: string;
    },
  ) {
    const phoneNumberId = this.config.getOrThrow<string>(
      'whatsapp.phoneNumberId',
    );
    const token = this.config.getOrThrow<string>('whatsapp.token');
    const useButtons =
      menu.choices.length <= 3 &&
      menu.choices.length >= 1 &&
      !menu.choices.some((c) => Boolean(c.description?.trim()));

    const interactive = useButtons
      ? {
          type: 'button',
          body: { text: menu.text },
          ...(menu.footerText ? { footer: { text: menu.footerText } } : {}),
          action: {
            buttons: menu.choices.slice(0, 3).map((c) => ({
              type: 'reply',
              reply: {
                id: c.id.slice(0, 256),
                title: truncateWhatsappTitle(c.title, 20),
              },
            })),
          },
        }
      : {
          type: 'list',
          body: { text: menu.text },
          ...(menu.footerText ? { footer: { text: menu.footerText } } : {}),
          action: {
            button: truncateWhatsappTitle(menu.listButton || 'Ver opções', 20),
            sections: [
              {
                title: 'Opções',
                rows: menu.choices.slice(0, 10).map((c) => ({
                  id: c.id.slice(0, 200),
                  title: truncateWhatsappTitle(c.title, 24),
                  ...(c.description
                    ? { description: c.description.slice(0, 72) }
                    : {}),
                })),
              },
            ],
          },
        };

    const resp = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'interactive',
        interactive,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `WhatsApp Cloud API recusou o menu (${resp.status}): ${text}`,
      );
    }
    return resp.json();
  }

  /**
   * Mensagem com botão que abre URL (CTA).
   * Meta: interactive cta_url.
   * Uazapi: tenta CTA; se indisponível, texto com instruções + link.
   */
  async sendCtaUrl(
    to: string,
    opts: {
      body: string;
      buttonText: string;
      url: string;
      footerText?: string;
    },
    instanceToken?: string,
  ) {
    const digits = String(to).replace(/\D/g, '');
    const buttonText = truncateWhatsappTitle(opts.buttonText, 20);
    if (this.provider() === 'uazapi') {
      const token =
        (instanceToken || '').trim() ||
        (this.config.get<string>('whatsapp.token') || '').trim();
      if (!token || !this.config.get<string>('whatsapp.baseUrl')) {
        throw new Error('Uazapi sem token para enviar CTA.');
      }
      try {
        return await this.sendCtaUrlUazapi(
          digits,
          { ...opts, buttonText },
          token,
        );
      } catch {
        const fallback = [
          opts.body.trim(),
          '',
          `${buttonText}:`,
          opts.url,
          opts.footerText ? `\n${opts.footerText}` : '',
        ]
          .filter(Boolean)
          .join('\n');
        return this.sendTextUazapi(digits, fallback, token);
      }
    }
    if (!this.isConfigured()) {
      throw new Error('WhatsApp Meta não configurado.');
    }
    return this.sendCtaUrlMeta(digits, { ...opts, buttonText });
  }

  private async sendCtaUrlUazapi(
    to: string,
    opts: {
      body: string;
      buttonText: string;
      url: string;
      footerText?: string;
    },
    token: string,
  ) {
    const baseUrl = this.uazapiBaseUrl();
    // Algumas builds Uazapi aceitam type=cta / cta_url no /send/menu.
    const attempts: Array<Record<string, unknown>> = [
      {
        number: to,
        type: 'cta_url',
        text: opts.body,
        footerText: opts.footerText,
        imageButton: '',
        choices: [`${opts.buttonText}|${opts.url}`],
        url: opts.url,
        displayText: opts.buttonText,
      },
      {
        number: to,
        type: 'button',
        text: opts.body,
        footerText: opts.footerText,
        choices: [`${opts.buttonText}|url:${opts.url}`],
      },
    ];

    let lastError: Error | null = null;
    for (const body of attempts) {
      const cleaned = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== undefined && v !== ''),
      );
      const resp = await fetch(`${baseUrl}/send/menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          token,
        },
        body: JSON.stringify(cleaned),
      });
      if (resp.ok) return resp.json();
      const text = await resp.text().catch(() => '');
      lastError = new Error(
        `Whazap/Uazapi recusou o CTA (${resp.status}): ${text}`,
      );
    }
    throw lastError || new Error('Whazap/Uazapi não aceitou CTA URL.');
  }

  private async sendCtaUrlMeta(
    to: string,
    opts: {
      body: string;
      buttonText: string;
      url: string;
      footerText?: string;
    },
  ) {
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
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: opts.body.slice(0, 1024) },
          ...(opts.footerText
            ? { footer: { text: opts.footerText.slice(0, 60) } }
            : {}),
          action: {
            name: 'cta_url',
            parameters: {
              display_text: opts.buttonText,
              url: opts.url,
            },
          },
        },
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `WhatsApp Cloud API recusou o CTA (${resp.status}): ${text}`,
      );
    }
    return resp.json();
  }

  /**
   * Configura o webhook na instância Uazapi apontando para a API Sof.
   */
  async configureUazapiWebhook(callbackUrl: string, instanceToken?: string) {
    if (this.provider() !== 'uazapi') {
      throw new Error(
        'Webhook Uazapi só se aplica com WHATSAPP_PROVIDER=uazapi.',
      );
    }
    const token =
      (instanceToken || '').trim() ||
      (this.config.get<string>('whatsapp.token') || '').trim();
    if (!token || !this.config.get<string>('whatsapp.baseUrl')) {
      throw new Error('Whazap/Uazapi não está configurado.');
    }
    const baseUrl = this.uazapiBaseUrl();

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
        excludeMessages: ['wasSentByApi', 'isGroupYes'],
        addUrlEvents: false,
        addUrlTypesMessages: false,
        // Evita empilhar vários webhooks iguais (causa envio duplicado).
        action: 'replace',
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
    if (!header || !req.rawBody)
      return { valid: false, skipped: false as const };

    const expected = `sha256=${createHmac('sha256', appSecret)
      .update(req.rawBody)
      .digest('hex')}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(String(header));
    const valid = a.length === b.length && timingSafeEqual(a, b);
    return { valid, skipped: false as const };
  }
}
