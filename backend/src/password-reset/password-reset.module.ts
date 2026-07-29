import { Module, forwardRef } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AccountPasswordTokenService } from '../auth/account-password-token.service';
import { AccountPasswordResetService } from '../auth/account-password-reset.service';
import { EmployeePasswordTokenService } from '../employee-portal/employee-password-token.service';
import { EmployeePasswordResetService } from '../employee-portal/employee-password-reset.service';

/**
 * Tokens + envio de reset (e-mail/WhatsApp) sem depender de Auth/Events,
 * evitando ciclos Auth ↔ EmployeePortal ↔ Events.
 */
@Module({
  imports: [forwardRef(() => WhatsappModule)],
  providers: [
    AccountPasswordTokenService,
    AccountPasswordResetService,
    EmployeePasswordTokenService,
    EmployeePasswordResetService,
  ],
  exports: [
    AccountPasswordTokenService,
    AccountPasswordResetService,
    EmployeePasswordTokenService,
    EmployeePasswordResetService,
  ],
})
export class PasswordResetModule {}
