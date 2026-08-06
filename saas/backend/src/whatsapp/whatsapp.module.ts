import { Module, forwardRef } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappApiService } from './whatsapp-api.service';
import { WhatsappBotService } from './whatsapp-bot.service';
import { WhatsappEmployeeBotService } from './whatsapp-employee-bot.service';
import { BookingNluService } from './booking-nlu.service';
import { EmployeeBookingNotifyService } from './employee-booking-notify.service';
import { AuthModule } from '../auth/auth.module';
import { WhatsappHandoffsModule } from '../whatsapp-handoffs/whatsapp-handoffs.module';
import { EmployeePortalModule } from '../employee-portal/employee-portal.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => WhatsappHandoffsModule),
    forwardRef(() => EmployeePortalModule),
    EntitlementsModule,
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappApiService,
    WhatsappBotService,
    WhatsappEmployeeBotService,
    BookingNluService,
    EmployeeBookingNotifyService,
  ],
  exports: [WhatsappApiService, EmployeeBookingNotifyService],
})
export class WhatsappModule {}
