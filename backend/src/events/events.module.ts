import { Global, Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { RealtimeService } from './realtime.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class EventsModule {}
