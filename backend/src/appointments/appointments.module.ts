import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentCompletionsService } from './appointment-completions.service';
import { AppointmentCompletionsScheduler } from './appointment-completions.scheduler';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [AuthModule, EventsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentCompletionsService, AppointmentCompletionsScheduler],
  exports: [AppointmentCompletionsService],
})
export class AppointmentsModule {}
