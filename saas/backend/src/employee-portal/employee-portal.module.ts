import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WhatsappHandoffsModule } from '../whatsapp-handoffs/whatsapp-handoffs.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EmployeeAuthController } from './employee-auth.controller';
import { EmployeeAppointmentsController } from './employee-appointments.controller';
import { EmployeeWhatsappHandoffsController } from './employee-whatsapp-handoffs.controller';
import { EmployeeEventsController } from './employee-events.controller';
import { EmployeeAuthGuard } from './employee-auth.guard';
import { EmployeePasswordTokenService } from './employee-password-token.service';
import { EmployeePasswordResetService } from './employee-password-reset.service';

@Module({
  imports: [
    forwardRef(() => EventsModule),
    forwardRef(() => WhatsappModule),
    forwardRef(() => WhatsappHandoffsModule),
    EntitlementsModule,
  ],
  controllers: [
    EmployeeAuthController,
    EmployeeAppointmentsController,
    EmployeeWhatsappHandoffsController,
    EmployeeEventsController,
  ],
  providers: [
    EmployeeAuthGuard,
    EmployeePasswordTokenService,
    EmployeePasswordResetService,
  ],
  exports: [
    EmployeeAuthGuard,
    EmployeePasswordTokenService,
    EmployeePasswordResetService,
  ],
})
export class EmployeePortalModule {}
