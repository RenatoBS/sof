import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { slugifyPlanName } from '../common/plans';
import {
  EntitlementsMap,
  FEATURE_CATALOG,
  defaultsForPlanSlug,
  hasFeature,
  limitValue,
  mergeEntitlements,
  PLAN_NAME_ALIASES,
} from './feature-catalog';

export class PlanGateException extends ForbiddenException {
  constructor(
    public readonly code: 'PLAN_FEATURE_REQUIRED' | 'PLAN_LIMIT_REACHED',
    public readonly feature: string,
    extras?: { limit?: number | null; current?: number },
  ) {
    const message =
      code === 'PLAN_LIMIT_REACHED'
        ? `Limite do plano atingido (${feature}).`
        : `Recurso não incluído no seu plano (${feature}).`;
    super({
      statusCode: 403,
      code,
      feature,
      message,
      ...(extras || {}),
    });
  }
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  catalog() {
    return FEATURE_CATALOG;
  }

  /**
   * Resolve entitlements da conta: Plan.entitlements (se planId) ou defaults
   * pelo nome do snapshot / Solo.
   */
  async forAccount(accountId: string): Promise<EntitlementsMap> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        plan: true,
        planId: true,
        planRef: { select: { slug: true, entitlements: true, name: true } },
      },
    });
    if (!account) throw new NotFoundException('Conta não encontrada.');
    return this.resolveFromAccount(account);
  }

  resolveFromAccount(account: {
    plan: string;
    planId: string | null;
    planRef?: { slug: string; entitlements: unknown; name: string } | null;
  }): EntitlementsMap {
    if (account.planRef) {
      return mergeEntitlements(
        account.planRef.entitlements,
        defaultsForPlanSlug(account.planRef.slug),
      );
    }
    const slug = this.slugFromPlanName(account.plan);
    return defaultsForPlanSlug(slug);
  }

  async forAccountOrLoad(account: {
    id: string;
    plan: string;
    planId: string | null;
    planRef?: { slug: string; entitlements: unknown; name: string } | null;
  }): Promise<EntitlementsMap> {
    if (account.planRef || !account.planId) {
      return this.resolveFromAccount(account);
    }
    return this.forAccount(account.id);
  }

  slugFromPlanName(name: string): string {
    const slug = slugifyPlanName(name || '');
    const aliased =
      PLAN_NAME_ALIASES[slug] || PLAN_NAME_ALIASES[name.toLowerCase()];
    return aliased || slug || 'solo';
  }

  async assertFeature(
    accountId: string,
    key: string,
  ): Promise<EntitlementsMap> {
    const ents = await this.forAccount(accountId);
    if (!hasFeature(ents, key)) {
      throw new PlanGateException('PLAN_FEATURE_REQUIRED', key);
    }
    return ents;
  }

  async assertLimit(
    accountId: string,
    key: string,
    currentCount: number,
  ): Promise<EntitlementsMap> {
    const ents = await this.forAccount(accountId);
    const limit = limitValue(ents, key);
    if (limit !== null && currentCount >= limit) {
      throw new PlanGateException('PLAN_LIMIT_REACHED', key, {
        limit,
        current: currentCount,
      });
    }
    return ents;
  }

  /**
   * WhatsApp: produto só suporta 1 número; efetivo = min(entitlement, 1).
   */
  effectiveWhatsappLimit(ents: EntitlementsMap): number {
    const limit = limitValue(ents, 'maxWhatsappNumbers');
    const capped = limit === null ? 1 : Math.min(limit, 1);
    return Math.max(capped, 0);
  }

  has(ents: EntitlementsMap, key: string) {
    return hasFeature(ents, key);
  }
}
