import { BadRequestException, Injectable } from '@nestjs/common';
import type { Account, Employee } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isValidPhone, normalizePhone } from '../common/phone';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';
import { EmployeePasswordTokenService } from './employee-password-token.service';

export type EmployeePasswordResetResult = {
  resetLink: string;
  expiresAt: Date;
  phone: string;
};

/**
 * Emite link de redefinição e envia CTA no WhatsApp do profissional.
 * Usado pelo painel da conta, “esqueci a senha” (web) e bot do profissional.
 */
@Injectable()
export class EmployeePasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordTokens: EmployeePasswordTokenService,
    private readonly whatsapp: WhatsappApiService,
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
        phone,
        {
          body,
          buttonText: 'Redefinir senha',
          url: resetLink,
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

    return { resetLink, expiresAt, phone };
  }
}
