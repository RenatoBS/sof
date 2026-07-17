import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { EmployeeAuthController } from './employee-auth.controller';
import { EmployeeAppointmentsController } from './employee-appointments.controller';
import { EmployeeAuthGuard } from './employee-auth.guard';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [EmployeeAuthController, EmployeeAppointmentsController],
  providers: [EmployeeAuthGuard],
  exports: [EmployeeAuthGuard],
})
export class EmployeePortalModule {}
