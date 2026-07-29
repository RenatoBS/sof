import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    if (this.isConfigured()) {
      const port = this.config.get<number>('mail.port') || 465;
      const secure = this.config.get<boolean>('mail.secure') ?? port === 465;
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('mail.host'),
        port,
        secure,
        auth: {
          user: this.config.get<string>('mail.user'),
          pass: this.config.get<string>('mail.pass'),
        },
      });
      this.logger.log(
        `SMTP pronto (${this.config.get<string>('mail.host')}:${port})`,
      );
    } else {
      this.logger.warn(
        'SMTP não configurado (SMTP_HOST/USER/PASS) — e-mails serão ignorados.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      (this.config.get<string>('mail.host') || '').trim() &&
        (this.config.get<string>('mail.user') || '').trim() &&
        (this.config.get<string>('mail.pass') || '').trim(),
    );
  }

  /**
   * Envia e-mail. Se SMTP estiver off, loga e retorna false (não lança).
   * Erros de envio são logados e retornam false.
   */
  async send(input: SendMailInput): Promise<boolean> {
    const to = String(input.to || '')
      .trim()
      .toLowerCase();
    if (!to) return false;

    if (!this.transporter) {
      this.logger.debug(
        `Mail skip (sem SMTP): to=${to} subject=${input.subject}`,
      );
      return false;
    }

    const from =
      this.config.get<string>('mail.from') ||
      this.config.get<string>('mail.user') ||
      'Sof <noreply@sof.local>';

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
      });
      this.logger.log(`E-mail enviado: ${input.subject} → ${to}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Falha ao enviar e-mail para ${to}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return false;
    }
  }
}
