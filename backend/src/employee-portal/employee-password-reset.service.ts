import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { Account, Employee } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isValidPhone, normalizePhone } from '../common/phone';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/mail-templates';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';
import { EmployeePasswordTokenService } from './employee-password-token.service';

export type EmployeePasswordResetResult = {
  resetLink: string;
  expiresAt: Date;
  phone: string;
};

/**
 * Emite link de redefinição.
 * - Painel / bot: WhatsApp obrigatório (`issueAndSendWhatsapp`).
 * - Esqueci a senha (web): WhatsApp + e-mail best-effort (`issueAndNotifyForgot`).
 */
@Injectable()
export class EmployeePasswordResetService {
  private readonly logger = new Logger(EmployeePasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordTokens: EmployeePasswordTokenService,
    private readonly whatsapp: WhatsappApiService,
    private readonly mail: MailService,
  ) {}

  assertCanSendWhatsapp(account: Account) {
    if (!account.whatsappConnectedAt) {
      throw new BadRequestException({
        error:
          'WhatsApp do estabelecimento não está conectado. Conecte em Conta antes de enviar.',
      });
    }
    if (this.whatsapp.provider() === 'uazapi') {
      const token = (account.whatsappInstanceToken || '').trim();
      if (!token && !this.whatsapp.isConfigured()) {
        throw new BadRequestException({
          error: 'WhatsApp não está configurado para envio.',
        });
      }
    } else if (!this.whatsapp.isConfigured()) {
      throw new BadRequestException({
        error: 'WhatsApp não está configurado para envio.',
      });
    }
  }

  /**
   * Invalida a senha atual, emite link (2h) e manda CTA no WhatsApp.
   * `source` muda o texto da mensagem (painel / self-service).
   */
  async issueAndSendWhatsapp(opts: {
    employee: Employee;
    account: Account;
    source: 'account' | 'self';
  }): Promise<EmployeePasswordResetResult> {
    const phone = normalizePhone(opts.employee.phone);
    if (!isValidPhone(phone)) {
      throw new BadRequestException({
        error:
          'Cadastre um telefone válido (com DDD) no profissional para enviar o link no WhatsApp.',
      });
    }

    this.assertCanSendWhatsapp(opts.account);

    await this.prisma.employee.update({
      where: { id: opts.employee.id },
      data: { passwordHash: null, mustChangePassword: true },
    });

    const { resetLink, expiresAt } = await this.passwordTokens.issueResetLink(
      opts.employee.id,
    );

    await this.sendWhatsappCta({
      employee: opts.employee,
      account: opts.account,
      phone,
      resetLink,
      source: opts.source,
    });

    return { resetLink, expiresAt, phone };
  }

  /**
   * Esqueci a senha (web): emite link e tenta WhatsApp + e-mail.
   * Não lança se um canal falhar; retorna quais canais enviaram.
   */
  async issueAndNotifyForgot(opts: {
    employee: Employee;
    account: Account;
  }): Promise<{
    resetLink: string;
    expiresAt: Date;
    channels: string[];
  }> {
    await this.prisma.employee.update({
      where: { id: opts.employee.id },
      data: { passwordHash: null, mustChangePassword: true },
    });

    const { resetLink, expiresAt } = await this.passwordTokens.issueResetLink(
      opts.employee.id,
    );

    const channels: string[] = [];
    const email = (opts.employee.email || '').trim().toLowerCase();
    if (email) {
      const tpl = passwordResetEmail({
        name: opts.employee.name,
        businessName: opts.account.businessName,
        resetLink,
        role: 'employee',
      });
      if (await this.mail.send({ to: email, ...tpl })) {
        channels.push('email');
      }
    }

    const phone = normalizePhone(opts.employee.phone);
    if (isValidPhone(phone)) {
      try {
        this.assertCanSendWhatsapp(opts.account);
        await this.sendWhatsappCta({
          employee: opts.employee,
          account: opts.account,
          phone,
          resetLink,
          source: 'self',
        });
        channels.push('whatsapp');
      } catch (err) {
        this.logger.warn(
          `WhatsApp reset prof ${opts.employee.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (channels.length === 0) {
      this.logger.warn(
        `Reset prof ${opts.employee.id}: nenhum canal enviou (e-mail/WhatsApp).`,
      );
    }

    return { resetLink, expiresAt, channels };
  }

  private async sendWhatsappCta(opts: {
    employee: Employee;
    account: Account;
    phone: string;
    resetLink: string;
    source: 'account' | 'self';
  }) {
    const businessName = opts.account.businessName || 'seu estabelecimento';
    const intro =
      opts.source === 'self'
        ? `Olá, ${opts.employee.name}! Você pediu para redefinir a senha da agenda Sof (${businessName}).`
        : `Olá, ${opts.employee.name}!\n\n${businessName} enviou um link para você definir (ou redefinir) a senha de acesso à agenda Sof.`;

    const body = [
      intro,
      '',
      'Instruções:',
      '1. Toque em "Redefinir senha"',
      '2. Crie uma senha nova',
      '3. Pronto — você já entra na sua agenda',
      '',
      'O link é de uso único e vale por 2 horas.',
    ].join('\n');

    try {
      await this.whatsapp.sendCtaUrl(
        opts.phone,
        {
          body,
          buttonText: 'Redefinir senha',
          url: opts.resetLink,
          footerText: 'Sof · acesso do profissional',
        },
        opts.account.whatsappInstanceToken || undefined,
      );
    } catch (err) {
      throw new BadRequestException({
        error:
          err instanceof Error
            ? `Não foi possível enviar no WhatsApp: ${err.message}`
            : 'Não foi possível enviar no WhatsApp.',
      });
    }
  }
}
