import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  generatePasswordToken,
  hashPasswordToken,
  PASSWORD_TOKEN_TTL_MS,
} from '../common/password-token';

/** @deprecated use PASSWORD_TOKEN_TTL_MS */
export const EMPLOYEE_PASSWORD_TOKEN_TTL_MS = PASSWORD_TOKEN_TTL_MS;

export { hashPasswordToken, generatePasswordToken };

@Injectable()
export class EmployeePasswordTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Invalida tokens abertos e emite um novo (uso único, 2h).
   * Retorna o link absoluto para a conta copiar.
   */
  async issueResetLink(employeeId: string) {
    const rawToken = generatePasswordToken();
    const tokenHash = hashPasswordToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_TOKEN_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.employeePasswordToken.updateMany({
        where: { employeeId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.employeePasswordToken.create({
        data: { employeeId, tokenHash, expiresAt },
      }),
    ]);

    const publicUrl = (
      this.config.get<string>('publicUrl') || 'http://localhost:8081'
    ).replace(/\/+$/, '');
    const resetLink = `${publicUrl}/employee/set-password?token=${encodeURIComponent(rawToken)}`;

    return { resetLink, expiresAt };
  }

  async findValidByRawToken(rawToken: string) {
    const token = String(rawToken || '').trim();
    if (!token) return null;

    const row = await this.prisma.employeePasswordToken.findUnique({
      where: { tokenHash: hashPasswordToken(token) },
      include: {
        employee: { include: { account: true } },
      },
    });
    if (!row || row.usedAt) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    if (!row.employee.email) return null;
    return row;
  }
}
