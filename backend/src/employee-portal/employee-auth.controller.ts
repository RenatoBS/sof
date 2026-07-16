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
import { hashPassword, verifyPassword } from '../common/password';
import {
  EMPLOYEE_COOKIE_NAME,
  cookieOptions,
  signEmployeeToken,
} from '../common/token';
import { publicEmployeeSession } from '../common/public-shapes';
import {
  EmployeeAuthGuard,
  type EmployeeAuthedRequest,
} from './employee-auth.guard';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Controller('api/employee-auth')
export class EmployeeAuthController {
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

    const employee = await this.prisma.employee.findUnique({
      where: { email },
      include: { account: true },
    });
    if (!employee?.passwordHash || !employee.email) {
      throw new UnauthorizedException({ error: 'E-mail não encontrado.' });
    }

    const ok = await verifyPassword(plainPassword, employee.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ error: 'Senha incorreta.' });
    }

    const jwtToken = signEmployeeToken(
      employee.id,
      employee.accountId,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    res.cookie(
      EMPLOYEE_COOKIE_NAME,
      jwtToken,
      cookieOptions(this.config.get<boolean>('isProd') === true),
    );

    return {
      employee: publicEmployeeSession(employee, employee.account),
      token: jwtToken,
    };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(EMPLOYEE_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(EmployeeAuthGuard)
  me(@Req() req: EmployeeAuthedRequest) {
    return {
      employee: publicEmployeeSession(req.employee, req.account),
    };
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  async changePassword(
    @Req() req: EmployeeAuthedRequest,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');

    if (!currentPassword || newPassword.length < 6) {
      throw new BadRequestException({
        error: 'A nova senha deve ter pelo menos 6 caracteres.',
      });
    }

    if (!req.employee.passwordHash) {
      throw new UnauthorizedException({ error: 'Conta sem senha.' });
    }

    const ok = await verifyPassword(currentPassword, req.employee.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({ error: 'Senha atual incorreta.' });
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException({
        error: 'A nova senha deve ser diferente da atual.',
      });
    }

    const passwordHash = await hashPassword(newPassword);
    const employee = await this.prisma.employee.update({
      where: { id: req.employee.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return {
      employee: publicEmployeeSession(employee, req.account),
    };
  }
}
