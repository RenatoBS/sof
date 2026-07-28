import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PromoCouponsService } from './promo-coupons.service';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

@Injectable()
export class PromoExpiryScheduler {
  private readonly logger = new Logger(PromoExpiryScheduler.name);

  constructor(private readonly promos: PromoCouponsService) {}

  @Interval(FIFTEEN_MINUTES_MS)
  async tick() {
    try {
      const count = await this.promos.pauseExpiredPromos();
      if (count > 0) {
        this.logger.log(`Pausou ${count} conta(s) com cupom expirado.`);
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao pausar promos expiradas: ${(err as Error).message}`,
      );
    }
  }
}
