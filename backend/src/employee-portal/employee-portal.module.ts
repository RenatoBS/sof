import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { EmployeeAuthController } from './employee-auth.controller';
import { EmployeeAppointmentsController } from './employee-appointments.controller';
import { EmployeeAuthGuard } from './employee-auth.guard';
import { EmployeePasswordTokenService } from './employee-password-token.service';
import { EmployeePasswordResetService } from './employee-password-reset.service';

@Module({
  imports: [EventsModule, forwardRef(() => WhatsappModule)],
  controllers: [EmployeeAuthController, EmployeeAppointmentsController],
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
