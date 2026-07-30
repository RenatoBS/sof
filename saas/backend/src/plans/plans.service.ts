import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FALLBACK_PLANS,
  type PlanDefinition,
  slugifyPlanName,
} from '../common/plans';
import {
  defaultsForPlanSlug,
  mergeEntitlements,
  type EntitlementsMap,
} from '../entitlements/feature-catalog';

function featuresFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

export type PlanRow = PlanDefinition & {
  id?: string;
  slug?: string;
  entitlements: EntitlementsMap;
};

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<PlanRow[]> {
    const rows = await this.prisma.plan.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { price: 'asc' }],
    });
    if (rows.length === 0) {
      return Object.values(FALLBACK_PLANS).map((p) => ({
        ...p,
        slug: slugifyPlanName(p.name),
        entitlements: mergeEntitlements(
          p.entitlements,
          defaultsForPlanSlug(slugifyPlanName(p.name)),
        ),
      }));
    }
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      stripePriceId: p.stripePriceId,
      paymentLinkUrl: p.paymentLinkUrl,
      features: featuresFromJson(p.features),
      entitlements: mergeEntitlements(
        p.entitlements,
        defaultsForPlanSlug(p.slug),
      ),
    }));
  }

  async getByName(planName: string): Promise<PlanRow | null> {
    const name = String(planName || '').trim();
    if (!name) return null;

    const row = await this.prisma.plan.findFirst({
      where: { name, active: true },
    });
    if (row) {
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: row.price,
        stripePriceId: row.stripePriceId,
        paymentLinkUrl: row.paymentLinkUrl,
        features: featuresFromJson(row.features),
        entitlements: mergeEntitlements(
          row.entitlements,
          defaultsForPlanSlug(row.slug),
        ),
      };
    }

    const fallback = FALLBACK_PLANS[name];
    if (!fallback) return null;
    return {
      ...fallback,
      slug: slugifyPlanName(fallback.name),
      entitlements: mergeEntitlements(
        fallback.entitlements,
        defaultsForPlanSlug(slugifyPlanName(fallback.name)),
      ),
    };
  }
}
