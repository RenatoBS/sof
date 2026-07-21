import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { BookingNluService } from './booking-nlu.service';
import { AuthModule } from '../auth/auth.module';
import { WhatsappHandoffsModule } from '../whatsapp-handoffs/whatsapp-handoffs.module';

@Module({
  imports: [AuthModule, WhatsappHandoffsModule],
  controllers: [WhatsappController],
  providers: [WhatsappApiService, WhatsappBotService, BookingNluService],
  exports: [WhatsappApiService],
})
export class WhatsappModule {}
