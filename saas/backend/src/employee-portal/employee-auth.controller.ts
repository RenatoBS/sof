import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
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
import {
  LOGIN_THROTTLE,
  PASSWORD_RESET_THROTTLE,
} from '../common/throttle-limits';
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
import { EmployeePasswordTokenService } from './employee-password-token.service';
import { EmployeePasswordResetService } from './employee-password-reset.service';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Controller('api/employee-auth')
export class EmployeeAuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly passwordTokens: EmployeePasswordTokenService,
    private readonly passwordReset: EmployeePasswordResetService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle(LOGIN_THROTTLE)
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

  /**
   * Esqueci a senha (profissional). Sempre responde OK genérico.
   * Envia link por e-mail e/ou WhatsApp quando possível.
   */
  @Post('request-password-reset')
  @HttpCode(200)
  @Throttle(PASSWORD_RESET_THROTTLE)
  async requestPasswordReset(@Body() body: { email?: string }) {
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();

    const generic = {
      ok: true,
      message:
        'Se houver um profissional com este e-mail, enviamos o link de redefinição por e-mail e/ou WhatsApp.',
    };

    if (!isEmail(email)) {
      throw new BadRequestException({
        error: 'Informe um e-mail válido.',
      });
    }

    const employee = await this.prisma.employee.findUnique({
      where: { email },
      include: { account: true },
    });
    if (!employee?.email) {
      return generic;
    }

    try {
      await this.passwordReset.issueAndNotifyForgot({
        employee,
        account: employee.account,
      });
    } catch {
      // Não vaza motivo (WhatsApp off, sem telefone, etc.)
      return generic;
    }

    return generic;
  }

  @Get('me')
  @UseGuards(EmployeeAuthGuard)
  me(@Req() req: EmployeeAuthedRequest) {
    return {
      employee: publicEmployeeSession(req.employee, req.account),
    };
  }

  /** Valida o link de convite/reset (público). */
  @Get('password-setup')
  @Throttle({ default: { limit: 60, ttl: 15 * 60 * 1000 } })
  async passwordSetupInfo(@Query('token') token?: string) {
    const row = await this.passwordTokens.findValidByRawToken(token || '');
    if (!row) {
      throw new BadRequestException({
        error: 'Link inválido, expirado ou já utilizado.',
      });
    }
    return {
      email: row.employee.email,
      name: row.employee.name,
      businessName: row.employee.account.businessName,
      expiresAt: row.expiresAt.toISOString(),
    };
  }

  /** Define senha via link (público) e faz login automático. */
  @Post('password-setup')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 15 * 60 * 1000 } })
  async passwordSetup(
    @Body() body: { token?: string; password?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const password = body?.password;
    if (!isValidAccountPassword(password)) {
      throw new BadRequestException({
        error: `A senha deve ter pelo menos ${ACCOUNT_PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    const row = await this.passwordTokens.findValidByRawToken(
      body?.token || '',
    );
    if (!row) {
      throw new BadRequestException({
        error: 'Link inválido, expirado ou já utilizado.',
      });
    }

    const passwordHash = await hashPassword(password);
    const employee = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.employeePasswordToken.updateMany({
        where: {
          id: row.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new BadRequestException({
          error: 'Link inválido, expirado ou já utilizado.',
        });
      }

      const updated = await tx.employee.update({
        where: { id: row.employeeId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
        include: { account: true },
      });

      await tx.employeePasswordToken.updateMany({
        where: {
          employeeId: row.employeeId,
          usedAt: null,
          id: { not: row.id },
        },
        data: { usedAt: new Date() },
      });
      return updated;
    });

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

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(EmployeeAuthGuard)
  async changePassword(
    @Req() req: EmployeeAuthedRequest,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');

    if (!currentPassword || !isValidAccountPassword(newPassword)) {
      throw new BadRequestException({
        error: `A nova senha deve ter pelo menos ${ACCOUNT_PASSWORD_MIN_LENGTH} caracteres.`,
      });
    }

    if (!req.employee.passwordHash) {
      throw new UnauthorizedException({
        error:
          'Conta sem senha. Peça um novo link de acesso ao responsável da conta.',
      });
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
