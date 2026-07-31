import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Account, Employee } from '@prisma/client';
import { extractEmployeeAuthFromRequest } from '../common/auth-request';
import { PrismaService } from '../prisma/prisma.service';

export type EmployeeAuthedRequest = Request & {
  employee: Employee;
  account: Account;
};

@Injectable()
export class EmployeeAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<EmployeeAuthedRequest>();
    const auth = extractEmployeeAuthFromRequest(
      req,
      this.config.getOrThrow<string>('jwtSecret'),
    );
    if (!auth) {
      throw new UnauthorizedException({ error: 'Não autenticado.' });
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: auth.employeeId, accountId: auth.accountId },
    });
    if (!employee || !employee.passwordHash) {
      throw new UnauthorizedException({
        error: 'Profissional não encontrado.',
      });
    }

    const account = await this.prisma.account.findUnique({
      where: { id: auth.accountId },
    });
    if (!account) {
      throw new UnauthorizedException({ error: 'Conta não encontrada.' });
    }

    req.employee = employee;
    req.account = account;
    return true;
  }
}
