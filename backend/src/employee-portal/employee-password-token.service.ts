import { createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export const EMPLOYEE_PASSWORD_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export function hashPasswordToken(rawToken: string) {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function generatePasswordToken() {
  return randomBytes(32).toString('base64url');
}

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
    const expiresAt = new Date(Date.now() + EMPLOYEE_PASSWORD_TOKEN_TTL_MS);

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
    const resetLink = `${publicUrl}/profissional/definir-senha?token=${encodeURIComponent(rawToken)}`;

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
