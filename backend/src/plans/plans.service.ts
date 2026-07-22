import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FALLBACK_PLANS,
  type PlanDefinition,
} from '../common/plans';

function featuresFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<PlanDefinition[]> {
    const rows = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
    if (rows.length === 0) {
      return Object.values(FALLBACK_PLANS);
    }
    return rows.map((p) => ({
      name: p.name,
      price: p.price,
      stripePriceId: p.stripePriceId,
      paymentLinkUrl: p.paymentLinkUrl,
      features: featuresFromJson(p.features),
    }));
  }

  async getByName(planName: string): Promise<PlanDefinition | null> {
    const name = String(planName || '').trim();
    if (!name) return null;

    const row = await this.prisma.plan.findFirst({
      where: { name, active: true },
    });
    if (row) {
      return {
        name: row.name,
        price: row.price,
        stripePriceId: row.stripePriceId,
        paymentLinkUrl: row.paymentLinkUrl,
        features: featuresFromJson(row.features),
      };
    }

    return FALLBACK_PLANS[name] || null;
  }
}
