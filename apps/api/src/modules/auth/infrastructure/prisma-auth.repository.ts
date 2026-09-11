import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Prisma, OAuthProvider } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { OAuthProviderName, ProviderIdentity } from '../domain/entities/provider-identity.js';
import type { AuthRepository, RotateRefreshResult } from '../domain/ports/auth.repository.js';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(
    identity: ProviderIdentity,
    now: Date,
  ): Promise<{ userId: string; created: boolean }> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const existing = await transaction.oAuthIdentity.findUnique({
              where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } },
            });
            if (existing !== null) return { userId: existing.userId, created: false };

            const userId = randomUUID();
            await transaction.user.create({ data: { id: userId, createdAt: now, updatedAt: now } });
            await transaction.oAuthIdentity.create({
              data: {
                id: randomUUID(),
                provider: this.toPrismaProvider(identity.provider),
                issuer: identity.issuer,
                subject: identity.subject,
                userId,
                createdAt: now,
                updatedAt: now,
              },
            });
            return { userId, created: true };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isRetryableIdentityConflict(error) || attempt === 2) throw error;
        const existing = await this.prisma.oAuthIdentity.findUnique({
          where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } },
        });
        if (existing !== null) return { userId: existing.userId, created: false };
      }
    }
    throw new Error('Identity creation retry exhausted');
  }

  async createSession(input: {
    userId: string;
    deviceName?: string;
    digest: string;
    expiresAt: Date;
    now: Date;
  }): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();
    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId: input.userId,
        ...(input.deviceName === undefined ? {} : { deviceName: input.deviceName }),
        expiresAt: input.expiresAt,
        lastRotatedAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
        refreshTokens: {
          create: {
            id: randomUUID(),
            digest: input.digest,
            expiresAt: input.expiresAt,
            createdAt: input.now,
          },
        },
      },
    });
    return { sessionId };
  }

  async rotateRefreshToken(input: {
    digest: string;
    nextDigest: string;
    nextExpiresAt: Date;
    now: Date;
  }): Promise<RotateRefreshResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const token = await transaction.refreshToken.findUnique({
              where: { digest: input.digest },
              include: { session: { include: { user: true } } },
            });
            if (token === null) return { status: 'INVALID' };

            if (token.usedAt !== null) {
              await transaction.authSession.update({
                where: { id: token.sessionId },
                data: { revokedAt: input.now, updatedAt: input.now },
              });
              return { status: 'REUSED' };
            }

            if (
              token.expiresAt <= input.now ||
              token.session.expiresAt <= input.now ||
              token.session.revokedAt !== null ||
              token.session.user.status !== 'ACTIVE'
            ) {
              return { status: 'INVALID' };
            }

            const consumed = await transaction.refreshToken.updateMany({
              where: { id: token.id, usedAt: null },
              data: { usedAt: input.now },
            });
            if (consumed.count !== 1) {
              await transaction.authSession.update({
                where: { id: token.sessionId },
                data: { revokedAt: input.now, updatedAt: input.now },
              });
              return { status: 'REUSED' };
            }

            await transaction.refreshToken.create({
              data: {
                id: randomUUID(),
                sessionId: token.sessionId,
                digest: input.nextDigest,
                expiresAt: input.nextExpiresAt,
                createdAt: input.now,
              },
            });
            await transaction.authSession.update({
              where: { id: token.sessionId },
              data: {
                expiresAt: input.nextExpiresAt,
                lastRotatedAt: input.now,
                updatedAt: input.now,
              },
            });
            return {
              status: 'ROTATED',
              userId: token.session.userId,
              sessionId: token.sessionId,
              expiresAt: input.nextExpiresAt,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (!this.isSerializationConflict(error) || attempt === 2) throw error;
      }
    }
    throw new Error('Refresh token rotation retry exhausted');
  }

  async revokeSession(userId: string, sessionId: string, now: Date): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: now, updatedAt: now },
    });
  }

  async isSessionActive(userId: string, sessionId: string, now: Date): Promise<boolean> {
    return (
      (await this.prisma.authSession.count({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
          expiresAt: { gt: now },
          user: { status: 'ACTIVE' },
        },
      })) === 1
    );
  }

  async findProviderForUser(userId: string): Promise<OAuthProviderName | null> {
    const identity = await this.prisma.oAuthIdentity.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return identity?.provider ?? null;
  }

  private toPrismaProvider(provider: OAuthProviderName): OAuthProvider {
    return provider === 'GOOGLE' ? OAuthProvider.GOOGLE : OAuthProvider.WECHAT;
  }

  private isRetryableIdentityConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    );
  }

  private isSerializationConflict(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
  }
}
