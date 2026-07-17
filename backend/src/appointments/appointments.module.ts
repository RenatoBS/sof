import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
