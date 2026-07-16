import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { ProvisionService } from './provision.service';
import { StripeService } from './stripe.service';

@Module({
  controllers: [CheckoutController],
  providers: [ProvisionService, StripeService],
  exports: [ProvisionService, StripeService],
})
export class CheckoutModule {}
