import { Module, forwardRef } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { EmployeeAuthController } from './employee-auth.controller';
import { EmployeeAppointmentsController } from './employee-appointments.controller';
import { EmployeeAuthGuard } from './employee-auth.guard';

@Module({
  imports: [
    forwardRef(() => EventsModule),
    forwardRef(() => WhatsappModule),
    PasswordResetModule,
  ],
  controllers: [EmployeeAuthController, EmployeeAppointmentsController],
  providers: [EmployeeAuthGuard],
  exports: [EmployeeAuthGuard, PasswordResetModule],
})
export class EmployeePortalModule {}
