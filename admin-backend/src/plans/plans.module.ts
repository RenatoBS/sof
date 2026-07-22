import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { StripeCatalogService } from './stripe-catalog.service';

@Module({
  controllers: [PlansController],
  providers: [StripeCatalogService],
})
export class PlansModule {}
