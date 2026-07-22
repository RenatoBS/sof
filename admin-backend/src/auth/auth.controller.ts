import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from '../common/password';
import { publicAdmin } from '../common/public-shapes';
import {
  ADMIN_COOKIE_NAME,
  cookieOptions,
  signAdminToken,
} from '../common/token';
import { AdminAuthGuard, type AuthedAdminRequest } from './admin-auth.guard';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!admin) {
      throw new UnauthorizedException({ error: 'E-mail não encontrado.' });
    }

    const ok = await verifyPassword(plainPassword, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ error: 'Senha incorreta.' });
    }

    const token = signAdminToken(
      admin.id,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    res.cookie(
      ADMIN_COOKIE_NAME,
      token,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );
    return { admin: publicAdmin(admin), token };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  me(@Req() req: AuthedAdminRequest) {
    return { admin: publicAdmin(req.admin) };
  }
}
