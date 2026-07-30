import { Controller, Get } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('api/plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  /** Catálogo público para pricing / checkout. */
  @Get()
  async list() {
    const plans = await this.plans.listActive();
    return {
      plans: plans.map((p) => ({
        name: p.name,
        price: p.price,
        features: p.features || [],
      })),
    };
  }
}
