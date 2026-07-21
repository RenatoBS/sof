import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsappHandoffsController } from './whatsapp-handoffs.controller';
import { WhatsappHandoffsService } from './whatsapp-handoffs.service';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappHandoffsController],
  providers: [WhatsappHandoffsService],
  exports: [WhatsappHandoffsService],
})
export class WhatsappHandoffsModule {}
