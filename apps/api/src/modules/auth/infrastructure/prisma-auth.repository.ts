import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Prisma, OAuthProvider } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { OAuthProviderName, ProviderIdentity } from '../domain/entities/provider-identity.js';
import type { LoginMethodView, PhoneFingerprint } from '../domain/entities/phone-auth.js';
import { AuthError } from '../domain/errors/auth.error.js';
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
              include: { user: true },
            });
            if (existing !== null) {
              this.assertActiveRecord(existing.user.status);
              return { userId: existing.userId, created: false };
            }

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
          include: { user: true },
        });
        if (existing !== null) {
          this.assertActiveRecord(existing.user.status);
          return { userId: existing.userId, created: false };
        }
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
    await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId}::uuid FOR UPDATE`;
      const user = await transaction.user.findUnique({ where: { id: input.userId } });
      this.assertActiveRecord(user?.status);
      await transaction.authSession.create({
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
            await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${token.session.userId}::uuid FOR UPDATE`;
            const user = await transaction.user.findUnique({
              where: { id: token.session.userId },
              select: { status: true },
            });

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
              user?.status !== 'ACTIVE'
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

  async assertActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    this.assertActiveRecord(user?.status);
  }

  async findOrCreatePhoneUser(
    phone: PhoneFingerprint,
    now: Date,
  ): Promise<{ userId: string; created: boolean }> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const existing = await transaction.phoneIdentity.findUnique({
              where: {
                phoneLookupVersion_phoneLookupHash: {
                  phoneLookupVersion: phone.lookupVersion,
                  phoneLookupHash: phone.lookupHash,
                },
              },
              include: { user: true },
            });
            if (existing) {
              this.assertActiveRecord(existing.user.status);
              return { userId: existing.userId, created: false };
            }
            const userId = randomUUID();
            await transaction.user.create({ data: { id: userId, createdAt: now, updatedAt: now } });
            await transaction.phoneIdentity.create({
              data: {
                id: randomUUID(),
                userId,
                phoneLookupVersion: phone.lookupVersion,
                phoneLookupHash: phone.lookupHash,
                countryCallingCode: phone.countryCallingCode,
                lastTwo: phone.lastTwo,
                verifiedAt: now,
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
      }
    }
    throw new Error('Phone identity creation retry exhausted');
  }

  async linkPhoneIdentity(
    userId: string,
    phone: PhoneFingerprint,
    now: Date,
  ): Promise<'CREATED' | 'ALREADY_LINKED'> {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        const user = await transaction.user.findUnique({ where: { id: userId } });
        this.assertActiveRecord(user?.status);
        const byPhone = await transaction.phoneIdentity.findUnique({
          where: {
            phoneLookupVersion_phoneLookupHash: {
              phoneLookupVersion: phone.lookupVersion,
              phoneLookupHash: phone.lookupHash,
            },
          },
        });
        if (byPhone) {
          if (byPhone.userId === userId) return 'ALREADY_LINKED';
          throw new AuthError('AUTH_IDENTITY_ALREADY_BOUND', 'Identity is already bound');
        }
        const current = await transaction.phoneIdentity.findUnique({ where: { userId } });
        if (current)
          throw new AuthError('AUTH_LOGIN_METHOD_ALREADY_BOUND', 'Login method is already bound');
        await transaction.phoneIdentity.create({
          data: {
            id: randomUUID(),
            userId,
            phoneLookupVersion: phone.lookupVersion,
            phoneLookupHash: phone.lookupHash,
            countryCallingCode: phone.countryCallingCode,
            lastTwo: phone.lastTwo,
            verifiedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        return 'CREATED';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async linkOAuthIdentity(
    userId: string,
    identity: ProviderIdentity,
    now: Date,
  ): Promise<'CREATED' | 'ALREADY_LINKED'> {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
        const user = await transaction.user.findUnique({ where: { id: userId } });
        this.assertActiveRecord(user?.status);
        const external = await transaction.oAuthIdentity.findUnique({
          where: { issuer_subject: { issuer: identity.issuer, subject: identity.subject } },
        });
        if (external) {
          if (external.userId === userId) return 'ALREADY_LINKED';
          throw new AuthError('AUTH_IDENTITY_ALREADY_BOUND', 'Identity is already bound');
        }
        const provider = this.toPrismaProvider(identity.provider);
        const current = await transaction.oAuthIdentity.findUnique({
          where: { userId_provider: { userId, provider } },
        });
        if (current)
          throw new AuthError('AUTH_LOGIN_METHOD_ALREADY_BOUND', 'Login method is already bound');
        await transaction.oAuthIdentity.create({
          data: {
            id: randomUUID(),
            userId,
            provider,
            issuer: identity.issuer,
            subject: identity.subject,
            createdAt: now,
            updatedAt: now,
          },
        });
        return 'CREATED';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async listLoginMethods(userId: string): Promise<LoginMethodView[]> {
    await this.assertActive(userId);
    const [phone, oauth] = await Promise.all([
      this.prisma.phoneIdentity.findUnique({ where: { userId } }),
      this.prisma.oAuthIdentity.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return [
      ...(phone
        ? [
            {
              type: 'PHONE' as const,
              verifiedAt: phone.verifiedAt,
              mask: `+${phone.countryCallingCode}••${phone.lastTwo}`,
            },
          ]
        : []),
      ...oauth.map((item) => ({ type: item.provider, verifiedAt: item.createdAt })),
    ];
  }

  async ownsOAuthIdentity(userId: string, identity: ProviderIdentity): Promise<boolean> {
    await this.assertActive(userId);
    return (
      (await this.prisma.oAuthIdentity.count({
        where: { userId, issuer: identity.issuer, subject: identity.subject },
      })) === 1
    );
  }

  async ownsPhoneIdentity(userId: string, phone: PhoneFingerprint): Promise<boolean> {
    await this.assertActive(userId);
    return (
      (await this.prisma.phoneIdentity.count({
        where: {
          userId,
          phoneLookupVersion: phone.lookupVersion,
          phoneLookupHash: phone.lookupHash,
        },
      })) === 1
    );
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

  private assertActiveRecord(status: string | undefined): void {
    if (status !== 'ACTIVE') {
      throw new AuthError('AUTH_ACCOUNT_UNAVAILABLE', 'Account is unavailable');
    }
  }
}
