import { Module } from '@nestjs/common';
import { CheckoutController } from './checkout.controller';
import { ProvisionService } from './provision.service';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  controllers: [CheckoutController],
  providers: [ProvisionService, MercadoPagoService],
  exports: [ProvisionService, MercadoPagoService],
})
export class CheckoutModule {}
