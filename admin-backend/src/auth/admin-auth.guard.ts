import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AdminUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { extractAdminToken, verifyAdminToken } from '../common/token';

export type AuthedAdminRequest = Request & { admin: AdminUser };

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedAdminRequest>();
    const token = extractAdminToken(req);
    if (!token) {
      throw new UnauthorizedException({ error: 'Não autenticado.' });
    }
    const adminId = verifyAdminToken(
      token,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    if (!adminId) {
      throw new UnauthorizedException({ error: 'Não autenticado.' });
    }
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
    });
    if (!admin) {
      throw new UnauthorizedException({ error: 'Admin não encontrado.' });
    }
    req.admin = admin;
    return true;
  }
}
