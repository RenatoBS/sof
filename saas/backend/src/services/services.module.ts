import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ServicesController],
})
export class ServicesModule {}
