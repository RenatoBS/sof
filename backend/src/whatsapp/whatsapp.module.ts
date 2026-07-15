import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappController],
  providers: [WhatsappApiService, WhatsappBotService],
})
export class WhatsappModule {}
