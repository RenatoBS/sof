import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Account } from '@prisma/client';
import { extractAccountIdFromRequest } from '../common/auth-request';
import { PrismaService } from '../prisma/prisma.service';

export type AuthedRequest = Request & { account: Account };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const accountId = extractAccountIdFromRequest(
      req,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    if (!accountId) {
      throw new UnauthorizedException({ error: 'Não autenticado.' });
    }
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new UnauthorizedException({ error: 'Conta não encontrada.' });
    }
    req.account = account;
    return true;
  }
}
