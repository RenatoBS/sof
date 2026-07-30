import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type UazapiInstanceCreated = {
  instanceId: string;
  token: string;
  name?: string;
};

export type UazapiConnectResult = {
  status: string;
  qrcode?: string;
  paircode?: string;
  instanceId?: string;
};

export type UazapiStatusResult = {
  status: string;
  qrcode?: string;
  paircode?: string;
  phone?: string;
  instanceId?: string;
};

/** Cliente Uazapi enxuto para ops no admin Sof (sem Meta / envio de mensagens). */
@Injectable()
export class WhatsappUazapiService {
  constructor(private readonly config: ConfigService) {}

  isAdminConfigured() {
    const baseUrl = this.config.get<string>('whatsapp.baseUrl') || '';
    const adminToken = this.config.get<string>('whatsapp.adminToken') || '';
    return Boolean(baseUrl && adminToken);
  }

  legacyInstanceToken() {
    return (this.config.get<string>('whatsapp.token') || '').trim();
  }

  legacyInstanceKey() {
    return (this.config.get<string>('whatsapp.phoneNumberId') || '').trim();
  }

  isPairingAvailable() {
    const baseUrl = this.config.get<string>('whatsapp.baseUrl') || '';
    if (!baseUrl) return false;
    return this.isAdminConfigured() || Boolean(this.legacyInstanceToken());
  }

  private baseUrl() {
    return (this.config.getOrThrow<string>('whatsapp.baseUrl') || '').replace(
      /\/+$/,
      '',
    );
  }

  private async fetchJson(
    path: string,
    opts: {
      method?: string;
      body?: unknown;
      auth: { kind: 'admin' } | { kind: 'token'; token: string };
    },
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (opts.auth.kind === 'admin') {
      headers.admintoken =
        this.config.getOrThrow<string>('whatsapp.adminToken');
    } else {
      headers.token = opts.auth.token;
    }

    const resp = await fetch(`${this.baseUrl()}${path}`, {
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
        `Uazapi ${path} falhou (${resp.status}): ${text.slice(0, 400)}`,
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
    const qrcode =
      this.pickString(raw, [
        'qrcode',
        'qrCode',
        'qr',
        'base64',
        'qrcodeBase64',
      ]) ||
      this.pickString(instance, [
        'qrcode',
        'qrCode',
        'qr',
        'base64',
        'qrcodeBase64',
      ]);
    const paircode =
      this.pickString(raw, ['paircode', 'pairCode', 'code', 'pairingCode']) ||
      this.pickString(instance, [
        'paircode',
        'pairCode',
        'code',
        'pairingCode',
      ]);
    return { qrcode: qrcode || undefined, paircode: paircode || undefined };
  }

  async createInstance(name: string): Promise<UazapiInstanceCreated> {
    if (!this.isAdminConfigured()) {
      throw new Error(
        'Uazapi admin não configurado (WHATSAPP_BASE_URL + WHATSAPP_ADMIN_TOKEN).',
      );
    }
    const raw = await this.fetchJson('/instance/init', {
      method: 'POST',
      auth: { kind: 'admin' },
      body: { name, systemName: 'Sof', adminField01: name },
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
        `Resposta inesperada ao criar instância: ${JSON.stringify(raw).slice(0, 300)}`,
      );
    }
    return { instanceId, token, name };
  }

  async connectInstance(
    token: string,
    phone?: string,
  ): Promise<UazapiConnectResult> {
    const body: Record<string, string> = {};
    if (phone) body.phone = phone.replace(/\D/g, '');
    const raw = await this.fetchJson('/instance/connect', {
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
    return {
      status: this.normalizeStatus(statusRaw),
      qrcode,
      paircode,
      instanceId,
    };
  }

  async instanceStatus(token: string): Promise<UazapiStatusResult> {
    const raw = await this.fetchJson('/instance/status', {
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
    };
  }

  async disconnectInstance(token: string) {
    return this.fetchJson('/instance/disconnect', {
      method: 'POST',
      auth: { kind: 'token', token },
      body: {},
    });
  }

  async configureWebhook(callbackUrl: string, instanceToken: string) {
    const token = instanceToken.trim();
    if (!token) throw new Error('Sem token de instância para webhook.');
    return this.fetchJson('/webhook', {
      method: 'POST',
      auth: { kind: 'token', token },
      body: {
        url: callbackUrl,
        enabled: true,
        events: ['messages'],
        excludeMessages: ['wasSentByApi', 'isGroupYes'],
        addUrlEvents: false,
        addUrlTypesMessages: false,
        action: 'replace',
      },
    });
  }
}
