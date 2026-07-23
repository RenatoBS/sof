import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentCompletionsService } from './appointment-completions.service';
import { AppointmentCompletionsScheduler } from './appointment-completions.scheduler';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [AuthModule, EventsModule, WhatsappModule],
  controllers: [AppointmentsController],
  providers: [AppointmentCompletionsService, AppointmentCompletionsScheduler],
  exports: [AppointmentCompletionsService],
})
export class AppointmentsModule {}
