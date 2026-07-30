import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountWhatsappAdminController } from './account-whatsapp.controller';
import { WhatsappUazapiService } from '../whatsapp/whatsapp-uazapi.service';

@Module({
  controllers: [AccountsController, AccountWhatsappAdminController],
  providers: [WhatsappUazapiService],
})
export class AccountsModule {}
