import { Module } from '@nestjs/common';
import { CheckoutModule } from '../checkout/checkout.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PlansModule } from '../plans/plans.module';
import { PromoCouponsModule } from '../promo-coupons/promo-coupons.module';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    PlansModule,
    PromoCouponsModule,
    CheckoutModule,
    EntitlementsModule,
  ],
  controllers: [BillingController],
})
export class BillingModule {}
