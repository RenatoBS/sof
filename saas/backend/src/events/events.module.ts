import { Global, Module, forwardRef } from '@nestjs/common';
import { EventsController } from './events.controller';
import { RealtimeService } from './realtime.service';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [EventsController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class EventsModule {}
