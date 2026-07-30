import { Module } from '@nestjs/common';
import { PromoCouponsService } from './promo-coupons.service';
import { PromoExpiryScheduler } from './promo-expiry.scheduler';

/** Depende de `ScheduleModule.forRoot()` já importado (ex.: RemindersModule). */
@Module({
  providers: [PromoCouponsService, PromoExpiryScheduler],
  exports: [PromoCouponsService],
})
export class PromoCouponsModule {}
