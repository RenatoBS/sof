import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountWhatsappController } from './account-whatsapp.controller';
import { AuthModule } from '../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [AuthModule, WhatsappModule, EntitlementsModule],
  controllers: [AccountController, AccountWhatsappController],
})
export class AccountModule {}
