import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [ClientsController],
})
export class ClientsModule {}
