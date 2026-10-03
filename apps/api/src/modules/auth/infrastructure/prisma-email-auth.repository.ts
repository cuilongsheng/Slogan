import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type EmailCredential } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { EmailAuthError } from '../domain/errors/email-auth.error.js';
import type {
  EmailAuthRepository,
  EnrollmentInput,
  EmailChallengeInput,
  EmailCredentialView,
} from '../domain/ports/email-auth.repository.js';

const minute = 60_000;
@Injectable()
export class PrismaEmailAuthRepository implements EmailAuthRepository {
  constructor(private readonly prisma: PrismaService) {}
  async enroll(input: EnrollmentInput) {
    return this.transaction(async (tx) => {
      if (input.link) {
        await this.activeUser(tx, input.link.userId, input.link.sessionId, input.now);
        const old = await tx.emailEnrollment.findUnique({
          where: {
            userId_commandId: { userId: input.link.userId, commandId: input.link.commandId },
          },
        });
        if (old) {
          if (old.payloadHash !== input.link.payloadHash)
            throw new EmailAuthError('EMAIL_COMMAND_CONFLICT');
          // Management tokens are not recoverable: replay cannot issue a fresh one.
          throw new EmailAuthError('EMAIL_COMMAND_CONFLICT');
        }
        if (await tx.emailCredential.findUnique({ where: { userId: input.link.userId } }))
          throw new EmailAuthError('EMAIL_USERNAME_TAKEN');
        const proof = await tx.emailAuthProof.updateMany({
          where: {
            tokenDigest: { in: input.link.proofDigests },
            purpose: 'LINK_EMAIL',
            userId: input.link.userId,
            sessionId: input.link.sessionId,
            commandId: input.link.commandId,
            consumedAt: null,
            expiresAt: { gt: input.now },
          },
          data: { consumedAt: input.now },
        });
        if (proof.count !== 1) throw new EmailAuthError('EMAIL_TOKEN_INVALID');
      }
      // Serialize pending-cap checks without creating a permanent identity lock.
      for (const key of [`email:${input.email}`, `username:${input.username}`].sort())
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
      await this.available(tx, input.username, input.email);
      for (const where of [{ username: input.username }, { email: input.email }]) {
        if (
          (await tx.emailEnrollment.count({
            where: { ...where, completedAt: null, expiresAt: { gt: input.now } },
          })) >= 3
        )
          throw new EmailAuthError('EMAIL_AUTH_RATE_LIMITED');
      }
      const enrollment = await tx.emailEnrollment.create({
        data: {
          id: input.id,
          purpose: input.link ? 'LINK' : 'REGISTER',
          username: input.username,
          email: input.email,
          passwordHash: input.passwordHash,
          managementDigest: input.managementDigest,
          lastSentAt: input.now,
          expiresAt: new Date(input.now.getTime() + 86400000),
          createdAt: input.now,
          ...(input.link
            ? {
                userId: input.link.userId,
                sessionId: input.link.sessionId,
                commandId: input.link.commandId,
                payloadHash: input.link.payloadHash,
              }
            : {}),
        },
      });
      await this.challenge(tx, input.challenge, {
        purpose: enrollment.purpose,
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        generation: 1,
        expiresAt: new Date(input.now.getTime() + 30 * minute),
        now: input.now,
      });
      return enrollment;
    });
  }
  findEnrollment(digests: string[], now: Date) {
    return this.prisma.emailEnrollment.findFirst({
      where: { managementDigest: { in: digests }, completedAt: null, expiresAt: { gt: now } },
    });
  }
  async resend(id: string, challenge: EmailChallengeInput, now: Date) {
    await this.transaction(async (tx) => {
      const initial = await tx.emailEnrollment.findUnique({ where: { id } });
      if (initial?.userId) await this.activeUser(tx, initial.userId, initial.sessionId!, now);
      await tx.$queryRaw`SELECT id FROM "EmailEnrollment" WHERE id=${id}::uuid FOR UPDATE`;
      const e = await tx.emailEnrollment.findUnique({ where: { id } });
      if (!e || e.completedAt || e.expiresAt <= now || !e.email)
        throw new EmailAuthError('EMAIL_TOKEN_INVALID');
      if (now.getTime() - e.lastSentAt.getTime() < minute)
        throw new EmailAuthError('EMAIL_AUTH_RATE_LIMITED');
      await tx.emailChallenge.updateMany({
        where: { enrollmentId: id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailDelivery.updateMany({
        where: { status: { in: ['PENDING', 'RUNNING'] }, challenge: { enrollmentId: id } },
        data: {
          encryptedPayload: null,
          status: 'CANCELLED',
          terminalAt: now,
          generation: { increment: 1 },
        },
      });
      await tx.emailEnrollment.update({
        where: { id },
        data: { generation: { increment: 1 }, lastSentAt: now },
      });
      await this.challenge(tx, challenge, {
        purpose: e.purpose,
        enrollmentId: id,
        userId: e.userId,
        generation: e.generation + 1,
        expiresAt: new Date(Math.min(e.expiresAt.getTime(), now.getTime() + 30 * minute)),
        now,
      });
    });
  }
  async confirm(
    digests: string[],
    purpose: 'REGISTER' | 'LINK',
    now: Date,
    identity?: { userId: string; sessionId: string },
  ) {
    await this.transaction(async (tx) => {
      if (purpose === 'LINK') {
        if (!identity) throw new EmailAuthError('EMAIL_TOKEN_INVALID');
        await this.activeUser(tx, identity.userId, identity.sessionId, now);
        await tx.$queryRaw`SELECT "userId" FROM "EmailCredential" WHERE "userId"=${identity.userId}::uuid FOR UPDATE`;
      }
      const initial = await tx.emailChallenge.findFirst({
        where: { tokenDigest: { in: digests }, purpose },
      });
      if (!initial?.enrollmentId) throw new EmailAuthError('EMAIL_TOKEN_INVALID');
      await tx.$queryRaw`SELECT id FROM "EmailEnrollment" WHERE id=${initial.enrollmentId}::uuid FOR UPDATE`;
      const c = await tx.emailChallenge.findUnique({ where: { id: initial.id } });
      const e = await tx.emailEnrollment.findUnique({ where: { id: initial.enrollmentId } });
      if (
        !c ||
        c.consumedAt ||
        c.expiresAt <= now ||
        !e ||
        e.completedAt ||
        e.expiresAt <= now ||
        c.generation !== e.generation ||
        !e.username ||
        !e.email ||
        !e.passwordHash ||
        (purpose === 'LINK' &&
          (e.userId !== identity?.userId || e.sessionId !== identity.sessionId))
      )
        throw new EmailAuthError('EMAIL_TOKEN_INVALID');
      await this.available(tx, e.username, e.email);
      const userId = identity?.userId ?? randomUUID();
      if (purpose === 'LINK' && (await tx.emailCredential.findUnique({ where: { userId } })))
        throw new EmailAuthError('EMAIL_USERNAME_TAKEN');
      if (purpose === 'REGISTER')
        await tx.user.create({ data: { id: userId, createdAt: now, updatedAt: now } });
      await tx.emailCredential.create({
        data: {
          userId,
          username: e.username,
          email: e.email,
          passwordHash: e.passwordHash,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.emailChallenge.updateMany({
        where: { enrollmentId: e.id, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailDelivery.updateMany({
        where: { status: { in: ['PENDING', 'RUNNING'] }, challenge: { enrollmentId: e.id } },
        data: {
          encryptedPayload: null,
          status: 'CANCELLED',
          terminalAt: now,
          generation: { increment: 1 },
        },
      });
      await tx.emailEnrollment.update({
        where: { id: e.id },
        data: {
          completedAt: now,
          passwordHash: null,
          managementDigest: null,
          username: null,
          email: null,
        },
      });
    });
  }
  async credential(username: string) {
    const c = await this.prisma.emailCredential.findUnique({
      where: { username },
      include: { user: { select: { status: true } } },
    });
    return c ? this.view(c) : null;
  }
  async credentialForUser(userId: string) {
    const c = await this.prisma.emailCredential.findUnique({
      where: { userId },
      include: { user: { select: { status: true } } },
    });
    return c ? this.view(c) : null;
  }
  async pending(username: string, now: Date) {
    const rows = await this.prisma.emailEnrollment.findMany({
      where: {
        username,
        purpose: 'REGISTER',
        completedAt: null,
        expiresAt: { gt: now },
        passwordHash: { not: null },
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: { passwordHash: true },
    });
    return rows.flatMap((r) => (r.passwordHash ? [r.passwordHash] : []));
  }
  async requestReset(email: string, challenge: EmailChallengeInput, now: Date) {
    await this.transaction(async (tx) => {
      const initial = await tx.emailCredential.findUnique({ where: { email } });
      if (!initial) return;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "userId" FROM "EmailCredential" WHERE "userId"=${initial.userId}::uuid FOR UPDATE`;
      const c = await tx.emailCredential.findUnique({ where: { email }, include: { user: true } });
      if (!c?.passwordHash || c.user.status !== 'ACTIVE') return;
      await this.challenge(tx, challenge, {
        purpose: 'RESET_PASSWORD',
        enrollmentId: null,
        userId: c.userId,
        generation: c.credentialVersion,
        credentialVersion: c.credentialVersion,
        expiresAt: new Date(now.getTime() + 15 * minute),
        now,
      });
    });
  }
  async reset(digests: string[], passwordHash: string, now: Date) {
    await this.transaction(async (tx) => {
      const initial = await tx.emailChallenge.findFirst({
        where: { tokenDigest: { in: digests }, purpose: 'RESET_PASSWORD' },
      });
      if (!initial?.userId) throw new EmailAuthError('EMAIL_TOKEN_INVALID');
      await this.activeUser(tx, initial.userId, undefined, now);
      await tx.$queryRaw`SELECT "userId" FROM "EmailCredential" WHERE "userId"=${initial.userId}::uuid FOR UPDATE`;
      const credential = await tx.emailCredential.findUnique({ where: { userId: initial.userId } });
      const challenge = await tx.emailChallenge.findUnique({ where: { id: initial.id } });
      if (
        !credential?.passwordHash ||
        !challenge ||
        challenge.consumedAt ||
        challenge.expiresAt <= now ||
        challenge.credentialVersion !== credential.credentialVersion
      )
        throw new EmailAuthError('EMAIL_TOKEN_INVALID');
      await tx.emailCredential.update({
        where: { userId: initial.userId },
        data: { passwordHash, credentialVersion: { increment: 1 }, updatedAt: now },
      });
      await tx.authSession.updateMany({
        where: { userId: initial.userId, revokedAt: null },
        data: { revokedAt: now, updatedAt: now },
      });
      await tx.emailAuthProof.updateMany({
        where: { userId: initial.userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailChallenge.updateMany({
        where: { userId: initial.userId, consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailDelivery.updateMany({
        where: { status: { in: ['PENDING', 'RUNNING'] }, challenge: { userId: initial.userId } },
        data: {
          encryptedPayload: null,
          status: 'CANCELLED',
          terminalAt: now,
          generation: { increment: 1 },
        },
      });
    });
  }
  async createProof(input: {
    id: string;
    userId: string;
    sessionId: string;
    commandId: string;
    purpose: 'LINK_EMAIL' | 'ACCOUNT_DELETE';
    tokenDigest: string;
    credentialVersion?: number;
    now: Date;
  }) {
    await this.transaction(async (tx) => {
      await this.activeUser(tx, input.userId, input.sessionId, input.now);
      if (input.credentialVersion !== undefined) {
        await tx.$queryRaw`SELECT "userId" FROM "EmailCredential" WHERE "userId"=${input.userId}::uuid FOR UPDATE`;
        const c = await tx.emailCredential.findUnique({ where: { userId: input.userId } });
        if (!c?.passwordHash || c.credentialVersion !== input.credentialVersion)
          throw new EmailAuthError('EMAIL_CREDENTIALS_INVALID');
      }
      const { now, ...data } = input;
      await tx.emailAuthProof.create({
        data: { ...data, expiresAt: new Date(now.getTime() + 5 * minute), createdAt: now },
      });
    });
  }
  private view(c: EmailCredential & { user: { status: string } }): EmailCredentialView {
    return { ...c, active: c.user.status === 'ACTIVE' };
  }
  private async activeUser(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string | undefined,
    now: Date,
  ) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user?.status !== 'ACTIVE') throw new EmailAuthError('EMAIL_TOKEN_INVALID');
    if (
      sessionId &&
      !(await tx.authSession.count({
        where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: now } },
      }))
    )
      throw new EmailAuthError('EMAIL_TOKEN_INVALID');
  }
  private async available(tx: Prisma.TransactionClient, username: string, email: string) {
    if (await tx.emailCredential.findUnique({ where: { username } }))
      throw new EmailAuthError('EMAIL_USERNAME_TAKEN');
    if (await tx.emailCredential.findUnique({ where: { email } }))
      throw new EmailAuthError('EMAIL_ADDRESS_TAKEN');
  }
  private async challenge(
    tx: Prisma.TransactionClient,
    input: EmailChallengeInput,
    subject: {
      purpose: 'REGISTER' | 'LINK' | 'RESET_PASSWORD';
      enrollmentId: string | null;
      userId: string | null;
      generation: number;
      credentialVersion?: number;
      expiresAt: Date;
      now: Date;
    },
  ) {
    const { now, ...data } = subject;
    await tx.emailChallenge.create({
      data: {
        ...data,
        id: input.id,
        tokenDigest: input.tokenDigest,
        createdAt: now,
        deliveries: {
          create: {
            id: input.deliveryId,
            keyId: input.keyId,
            encryptedPayload: input.encryptedPayload,
            nextAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    });
  }
  private async transaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let i = 0; i < 3; i++) {
      try {
        return await this.prisma.$transaction(action, { timeout: 10000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' && i < 2) continue;
          if (error.code === 'P2002') {
            const target = JSON.stringify(error.meta?.target ?? '');
            throw new EmailAuthError(
              target.includes('email')
                ? 'EMAIL_ADDRESS_TAKEN'
                : target.includes('username')
                  ? 'EMAIL_USERNAME_TAKEN'
                  : 'EMAIL_COMMAND_CONFLICT',
            );
          }
        }
        throw error;
      }
    }
    throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
  }
}
