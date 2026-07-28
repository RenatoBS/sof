import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
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
import { verifyPassword } from '../common/password';
import {
  COOKIE_NAME,
  cookieOptions,
  signAccountToken,
} from '../common/token';
import { publicAccount } from '../common/public-shapes';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { PromoCouponsService } from '../promo-coupons/promo-coupons.service';
import { AuthGuard } from './auth.guard';
import type { AuthedRequest } from './auth.guard';

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
