import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RemindersService } from './reminders.service';
import { RemindersScheduler } from './reminders.scheduler';

@Module({
  imports: [ScheduleModule.forRoot(), WhatsappModule],
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersModule {}
