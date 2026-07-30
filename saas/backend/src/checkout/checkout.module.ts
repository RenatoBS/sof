import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { PromoCouponsModule } from '../promo-coupons/promo-coupons.module';
import { CheckoutController } from './checkout.controller';
import { ProvisionService } from './provision.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [PlansModule, PromoCouponsModule],
  controllers: [CheckoutController],
  providers: [ProvisionService, StripeService],
  exports: [ProvisionService, StripeService],
})
export class CheckoutModule {}
