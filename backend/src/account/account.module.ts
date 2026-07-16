import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountWhatsappController } from './account-whatsapp.controller';
import { AuthModule } from '../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [AuthModule, WhatsappModule],
  controllers: [AccountController, AccountWhatsappController],
})
export class AccountModule {}
