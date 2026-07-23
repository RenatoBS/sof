import { Module, forwardRef } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappEmployeeBotService } from './whatsapp-employee-bot.service';
import { BookingNluService } from './booking-nlu.service';
import { AuthModule } from '../auth/auth.module';
import { WhatsappHandoffsModule } from '../whatsapp-handoffs/whatsapp-handoffs.module';
import { EmployeePortalModule } from '../employee-portal/employee-portal.module';

@Module({
  imports: [
    AuthModule,
    WhatsappHandoffsModule,
    forwardRef(() => EmployeePortalModule),
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappApiService,
    WhatsappBotService,
    WhatsappEmployeeBotService,
    BookingNluService,
  ],
  exports: [WhatsappApiService],
})
export class WhatsappModule {}
