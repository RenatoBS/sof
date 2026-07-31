import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNT_PASSWORD_MIN_LENGTH,
  hashPassword,
  isValidAccountPassword,
  verifyPassword,
} from '../common/password';
import { COOKIE_NAME, cookieOptions, signAccountToken } from '../common/token';
import { publicAccount } from '../common/public-shapes';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PromoCouponsService } from '../promo-coupons/promo-coupons.service';
import { AuthGuard } from './auth.guard';
import type { AuthedRequest } from './auth.guard';
import { AccountPasswordTokenService } from './account-password-token.service';
import { AccountPasswordResetService } from './account-password-reset.service';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly entitlements: EntitlementsService,
    private readonly promos: PromoCouponsService,
    private readonly accountPasswordTokens: AccountPasswordTokenService,
    private readonly accountPasswordReset: AccountPasswordResetService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const plainPassword = String(body?.password || '');

    if (!isEmail(email) || !plainPassword) {
      throw new BadRequestException({
        error: 'Informe e-mail e senha válidos.',
      });
    }

    let account = await this.prisma.account.findUnique({ where: { email } });
    if (!account) {
      throw new UnauthorizedException({ error: 'E-mail não encontrado.' });
    }

    const ok = await verifyPassword(plainPassword, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ error: 'Senha incorreta.' });
    }

    account = await this.promos.pauseIfPromoExpired(account);

    const jwtToken = signAccountToken(
      account.id,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    res.cookie(
      COOKIE_NAME,
      jwtToken,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );
    const entitlements = await this.entitlements.forAccount(account.id);
    return {
      account: { ...publicAccount(account), entitlements },
      token: jwtToken,
    };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  /**
   * Esqueci a senha (conta). Sempre responde OK genérico.
   * E-mail + WhatsApp quando possível. Profissionais usam /api/employee-auth/….
   */
  @Post('request-password-reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 15 * 60 * 1000 } })
  async requestPasswordReset(@Body() body: { email?: string }) {
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();

    const generic = {
      ok: true,
      message:
        'Se houver uma conta com este e-mail, enviamos o link de redefinição por e-mail e/ou WhatsApp.',
    };

    if (!isEmail(email)) {
      throw new BadRequestException({
        error: 'Informe um e-mail válido.',
      });
    }

    const account = await this.prisma.account.findUnique({ where: { email } });
    if (account) {
      try {
        await this.accountPasswordReset.issueAndNotifyForgot(account);
      } catch {
        // não vaza motivo
      }
    }

    return generic;
  }

  /** Valida o link de reset da conta (público). */
  @Get('password-setup')
  @Throttle({ default: { limit: 30, ttl: 15 * 60 * 1000 } })
  async passwordSetupInfo(@Query('token') token?: string) {
    const row = await this.accountPasswordTokens.findValidByRawToken(
      String(token || ''),
    );
    if (!row) {
      throw new BadRequestException({
        error: 'Link inválido, expirado ou já utilizado.',
      });
    }
    return {
      email: row.account.email,
      name: row.account.ownerName || row.account.businessName,
      businessName: row.account.businessName,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /** Define nova senha da conta via token e faz login. */
  @Post('password-setup')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  async passwordSetup(
    @Body() body: { token?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = String(body?.token || '').trim();
    const password = String(body?.password || '');
    if (!isValidAccountPassword(password)) {
      throw new BadRequestException({
        error: `A senha deve ter pelo menos ${ACCOUNT_PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    const row = await this.accountPasswordTokens.findValidByRawToken(rawToken);
    if (!row) {
      throw new BadRequestException({
        error: 'Link inválido, expirado ou já utilizado.',
      });
    }

    const passwordHash = await hashPassword(password);
    const account = await this.prisma.$transaction(async (tx) => {
      await tx.accountPasswordToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return tx.account.update({
        where: { id: row.accountId },
        data: { passwordHash },
      });
    });

    const refreshed = await this.promos.pauseIfPromoExpired(account);
    const jwtToken = signAccountToken(
      refreshed.id,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    res.cookie(
      COOKIE_NAME,
      jwtToken,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );
    const entitlements = await this.entitlements.forAccount(refreshed.id);
    return {
      account: { ...publicAccount(refreshed), entitlements },
      token: jwtToken,
    };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthedRequest) {
    const account = await this.promos.pauseIfPromoExpired(req.account);
    const entitlements = await this.entitlements.forAccount(account.id);
    return {
      account: { ...publicAccount(account), entitlements },
    };
  }
}
