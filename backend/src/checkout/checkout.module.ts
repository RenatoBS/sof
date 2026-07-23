import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { CheckoutController } from './checkout.controller';
import { ProvisionService } from './provision.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [PlansModule],
  controllers: [CheckoutController],
  providers: [ProvisionService, StripeService],
  exports: [ProvisionService, StripeService],
})
export class CheckoutModule {}
