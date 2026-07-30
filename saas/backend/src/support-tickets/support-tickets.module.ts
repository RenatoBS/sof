import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupportTicketsController } from './support-tickets.controller';
import { TenantAuthGuard } from './tenant-auth.guard';

@Module({
  imports: [AuthModule],
  controllers: [SupportTicketsController],
  providers: [TenantAuthGuard],
})
export class SupportTicketsModule {}
