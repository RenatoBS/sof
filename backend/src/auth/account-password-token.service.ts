import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  generatePasswordToken,
  hashPasswordToken,
  PASSWORD_TOKEN_TTL_MS,
} from '../common/password-token';

@Injectable()
export class AccountPasswordTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async issueResetLink(accountId: string) {
    const rawToken = generatePasswordToken();
    const tokenHash = hashPasswordToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_TOKEN_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.accountPasswordToken.updateMany({
        where: { accountId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.accountPasswordToken.create({
        data: { accountId, tokenHash, expiresAt },
      }),
    ]);

    const publicUrl = (
      this.config.get<string>('publicUrl') || 'http://localhost:8081'
    ).replace(/\/+$/, '');
    const resetLink = `${publicUrl}/definir-senha?token=${encodeURIComponent(rawToken)}`;

    return { resetLink, expiresAt };
  }

  async findValidByRawToken(rawToken: string) {
    const token = String(rawToken || '').trim();
    if (!token) return null;

    const row = await this.prisma.accountPasswordToken.findUnique({
      where: { tokenHash: hashPasswordToken(token) },
      include: { account: true },
    });
    if (!row || row.usedAt) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return row;
  }
}
