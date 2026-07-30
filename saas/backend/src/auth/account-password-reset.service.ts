import { Injectable, Logger } from '@nestjs/common';
import type { Account } from '@prisma/client';
import { isValidPhone, normalizePhone } from '../common/phone';
import { MailService } from '../mail/mail.service';
import { passwordResetEmail } from '../mail/mail-templates';
import { WhatsappApiService } from '../whatsapp/whatsapp-api.service';
import { AccountPasswordTokenService } from './account-password-token.service';

/**
 * Esqueci a senha da conta (dono): e-mail + WhatsApp (best-effort em cada canal).
 */
@Injectable()
export class AccountPasswordResetService {
  private readonly logger = new Logger(AccountPasswordResetService.name);

  constructor(
    private readonly passwordTokens: AccountPasswordTokenService,
    private readonly whatsapp: WhatsappApiService,
    private readonly mail: MailService,
  ) {}

  async issueAndNotifyForgot(account: Account): Promise<{
    resetLink: string;
    expiresAt: Date;
    channels: string[];
  }> {
    // Não invalida a senha atual até o usuário concluir o link —
    // se e-mail/WhatsApp falharem, a conta continua acessível.
    const { resetLink, expiresAt } = await this.passwordTokens.issueResetLink(
      account.id,
    );

    const channels: string[] = [];
    const name = account.ownerName || account.businessName || 'olá';

    const mailTpl = passwordResetEmail({
      name,
      businessName: account.businessName,
      resetLink,
      role: 'account',
    });
    if (await this.mail.send({ to: account.email, ...mailTpl })) {
      channels.push('email');
    }

    const phone = normalizePhone(account.phone);
    if (
      isValidPhone(phone) &&
      account.whatsappConnectedAt &&
      (this.whatsapp.provider() !== 'uazapi' ||
        Boolean((account.whatsappInstanceToken || '').trim()) ||
        this.whatsapp.isConfigured())
    ) {
      const body = [
        `Olá, ${name}!`,
        '',
        'Você pediu para redefinir a senha do painel Sof.',
        '',
        'Toque em "Redefinir senha", crie uma senha nova e entre no painel.',
        'O link é de uso único e vale por 2 horas.',
      ].join('\n');
      try {
        await this.whatsapp.sendCtaUrl(
          phone,
          {
            body,
            buttonText: 'Redefinir senha',
            url: resetLink,
            footerText: 'Sof · painel',
          },
          account.whatsappInstanceToken || undefined,
        );
        channels.push('whatsapp');
      } catch (err) {
        this.logger.warn(
          `WhatsApp reset conta ${account.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    if (channels.length === 0) {
      this.logger.warn(
        `Reset conta ${account.id}: nenhum canal enviou (e-mail/WhatsApp).`,
      );
    }

    return { resetLink, expiresAt, channels };
  }
}
