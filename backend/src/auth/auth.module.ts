import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PromoCouponsModule } from '../promo-coupons/promo-coupons.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';

@Module({
  imports: [EntitlementsModule, PromoCouponsModule, PasswordResetModule],
  controllers: [AuthController],
  providers: [AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
