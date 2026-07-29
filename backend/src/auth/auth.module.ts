import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PromoCouponsModule } from '../promo-coupons/promo-coupons.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AccountPasswordTokenService } from './account-password-token.service';
import { AccountPasswordResetService } from './account-password-reset.service';

@Module({
  imports: [
    EntitlementsModule,
    PromoCouponsModule,
    forwardRef(() => WhatsappModule),
  ],
  controllers: [AuthController],
  providers: [
    AuthGuard,
    AccountPasswordTokenService,
    AccountPasswordResetService,
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
