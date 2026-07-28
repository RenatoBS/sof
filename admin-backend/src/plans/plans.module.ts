import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { FeatureCatalogController } from './feature-catalog.controller';
import { StripeCatalogService } from './stripe-catalog.service';

@Module({
  controllers: [PlansController, FeatureCatalogController],
  providers: [StripeCatalogService],
})
export class PlansModule {}
