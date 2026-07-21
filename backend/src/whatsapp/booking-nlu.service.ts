import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 10_000;

const WEEKDAYS_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export type BookingIntent = {
  intent: 'book' | 'cancel' | 'list' | 'other';
  serviceId?: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
};

/**
 * Interpreta frases livres (ex.: áudio transcrito) e extrai a intenção de
 * agendamento: serviço, data e hora. Usa a mesma OPENAI_API_KEY da transcrição.
 */
@Injectable()
export class BookingNluService {
  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return Boolean(
      (this.config.get<string>('whatsapp.openaiApiKey') || '').trim(),
    );
  }

  async extract(opts: {
    text: string;
    services: Array<{ id: string; name: string }>;
    now?: Date;
  }): Promise<BookingIntent | null> {
    const apiKey = (
      this.config.get<string>('whatsapp.openaiApiKey') || ''
    ).trim();
    if (!apiKey) return null;

    const now = opts.now || new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const weekday = WEEKDAYS_PT[now.getDay()];
    const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const serviceList = opts.services
      .map((s) => `- id: ${s.id} | nome: ${s.name}`)
      .join('\n');

    const system = [
      'Você extrai a intenção de agendamento de mensagens de clientes de um salão (PT-BR).',
      `Hoje é ${weekday}, ${today}, agora são ${nowTime}.`,
      'Serviços disponíveis:',
      serviceList,
      '',
      'Responda SOMENTE um JSON com os campos:',
      '- intent: "book" (quer marcar), "cancel" (quer cancelar), "list" (quer ver agendamentos) ou "other"',
      '- serviceId: id do serviço citado (escolha o mais próximo do que a pessoa falou) ou null',
      '- date: data desejada em YYYY-MM-DD ou null (resolva termos como hoje, amanhã, sexta que vem)',
      '- time: hora desejada em HH:MM (24h) ou null (meio-dia = 12:00, "3 da tarde" = 15:00)',
      '',
      'Nunca invente serviço que não esteja na lista. Se não tiver certeza, use null.',
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: opts.text.slice(0, 500) },
          ],
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.error(
          `[whatsapp] NLU OpenAI falhou (${resp.status}): ${errText.slice(0, 300)}`,
        );
        return null;
      }
      const json = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content || '';
      return this.parseIntent(content, opts.services, today);
    } catch (err) {
      console.error(
        '[whatsapp] NLU OpenAI erro:',
        err instanceof Error ? err.message : err,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseIntent(
    content: string,
    services: Array<{ id: string }>,
    today: string,
  ): BookingIntent | null {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return null;
    }

    const intentRaw = String(raw.intent || 'other');
    const intent: BookingIntent['intent'] =
      intentRaw === 'book' ||
      intentRaw === 'cancel' ||
      intentRaw === 'list'
        ? intentRaw
        : 'other';

    const result: BookingIntent = { intent };

    const serviceId = String(raw.serviceId || '').trim();
    if (serviceId && services.some((s) => s.id === serviceId)) {
      result.serviceId = serviceId;
    }

    const date = String(raw.date || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today) {
      result.date = date;
    }

    const time = String(raw.time || '').trim();
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hh = Number(timeMatch[1]);
      const min = Number(timeMatch[2]);
      if (hh <= 23 && min <= 59) {
        result.time = `${String(hh).padStart(2, '0')}:${timeMatch[2]}`;
      }
    }

    return result;
  }
}
