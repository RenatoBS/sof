import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { CheckoutModule } from '../checkout/checkout.module';

@Module({
  imports: [CheckoutModule],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
