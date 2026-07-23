import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Account, Employee } from '@prisma/client';
import {
  extractAccountIdFromRequest,
  extractEmployeeAuthFromRequest,
} from '../common/auth-request';
import { PrismaService } from '../prisma/prisma.service';

export type TenantActor =
  | { role: 'account' }
  | { role: 'employee'; employeeId: string; employeeName: string };

export type TenantAuthedRequest = Request & {
  account: Account;
  employee?: Employee;
  actor: TenantActor;
};

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantAuthedRequest>();
    const secret = this.config.getOrThrow<string>('jwtSecret');

    const accountId = extractAccountIdFromRequest(req, secret);
    if (accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: accountId },
      });
      if (!account) {
        throw new UnauthorizedException({ error: 'Conta não encontrada.' });
      }
      req.account = account;
      req.actor = { role: 'account' };
      return true;
    }

    const employeeAuth = extractEmployeeAuthFromRequest(req, secret);
    if (employeeAuth) {
      const employee = await this.prisma.employee.findFirst({
        where: {
          id: employeeAuth.employeeId,
          accountId: employeeAuth.accountId,
        },
      });
      if (!employee || !employee.passwordHash) {
        throw new UnauthorizedException({
          error: 'Profissional não encontrado.',
        });
      }
      const account = await this.prisma.account.findUnique({
        where: { id: employeeAuth.accountId },
      });
      if (!account) {
        throw new UnauthorizedException({ error: 'Conta não encontrada.' });
      }
      req.account = account;
      req.employee = employee;
      req.actor = {
        role: 'employee',
        employeeId: employee.id,
        employeeName: employee.name,
      };
      return true;
    }

    throw new UnauthorizedException({ error: 'Não autenticado.' });
  }
}
