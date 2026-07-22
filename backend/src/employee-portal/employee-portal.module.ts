import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { EmployeeAuthController } from './employee-auth.controller';
import { EmployeeAppointmentsController } from './employee-appointments.controller';
import { EmployeeAuthGuard } from './employee-auth.guard';
import { EmployeePasswordTokenService } from './employee-password-token.service';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [EmployeeAuthController, EmployeeAppointmentsController],
  providers: [EmployeeAuthGuard, EmployeePasswordTokenService],
  exports: [EmployeeAuthGuard, EmployeePasswordTokenService],
})
export class EmployeePortalModule {}
