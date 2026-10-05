import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  ClaimedEmailDelivery,
  EmailDeliveryRepository,
} from '../domain/ports/email-delivery.repository.js';

@Injectable()
export class PrismaEmailDeliveryRepository implements EmailDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}
  async claim(now: Date): Promise<ClaimedEmailDelivery[]> {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT d.id FROM "EmailDelivery" d JOIN "EmailChallenge" c ON c.id=d."challengeId"
        LEFT JOIN "EmailEnrollment" e ON e.id=c."enrollmentId"
        LEFT JOIN "User" u ON u.id=c."userId"
        WHERE d."encryptedPayload" IS NOT NULL AND d.attempts<5
        AND ((d.status='PENDING' AND d."nextAttemptAt"<=${now}) OR (d.status='RUNNING' AND d."leaseUntil"<=${now}))
        AND c."consumedAt" IS NULL AND c."expiresAt">${now}
        AND (c."userId" IS NULL OR u.status='ACTIVE')
        AND (c."enrollmentId" IS NULL OR (e."completedAt" IS NULL AND e."expiresAt">${now} AND e.generation=c.generation))
        ORDER BY d."nextAttemptAt" LIMIT 20 FOR UPDATE OF d SKIP LOCKED`;
      const result: ClaimedEmailDelivery[] = [];
      for (const { id } of candidates) {
        const row = await tx.emailDelivery.update({
          where: { id },
          data: {
            status: 'RUNNING',
            attempts: { increment: 1 },
            generation: { increment: 1 },
            leaseUntil: new Date(now.getTime() + 60000),
            updatedAt: now,
          },
        });
        result.push({
          id,
          generation: row.generation,
          encryptedPayload: row.encryptedPayload!,
          keyId: row.keyId,
        });
      }
      return result;
    });
  }
  async settle(
    id: string,
    generation: number,
    result: 'SENT' | 'REJECTED' | 'UNCERTAIN' | 'INVALID_PAYLOAD',
    now: Date,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "EmailDelivery" WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.emailDelivery.findUnique({ where: { id } });
      if (
        !row ||
        row.status !== 'RUNNING' ||
        row.generation !== generation ||
        !row.leaseUntil ||
        row.leaseUntil <= now
      )
        return;
      const terminal = result === 'SENT' || result === 'INVALID_PAYLOAD' || row.attempts >= 5;
      await tx.emailDelivery.update({
        where: { id },
        data: {
          status: result === 'SENT' ? 'DELIVERED' : terminal ? 'FAILED' : 'PENDING',
          resultCode: result,
          leaseUntil: null,
          terminalAt: terminal ? now : null,
          ...(terminal ? { encryptedPayload: null } : {}),
          nextAttemptAt: new Date(now.getTime() + Math.min(3600000, 1000 * 2 ** row.attempts)),
          updatedAt: now,
        },
      });
    });
  }
  async cancelPending(now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.emailDelivery.updateMany({
        where: { status: { in: ['PENDING', 'RUNNING'] } },
        data: {
          status: 'CANCELLED',
          encryptedPayload: null,
          terminalAt: now,
          leaseUntil: null,
          generation: { increment: 1 },
        },
      });
      await tx.emailChallenge.updateMany({
        where: { consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailAuthProof.updateMany({
        where: { purpose: 'LINK_EMAIL', consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.emailEnrollment.updateMany({
        where: { completedAt: null },
        data: {
          expiresAt: now,
          username: null,
          email: null,
          passwordHash: null,
          managementDigest: null,
        },
      });
    });
  }
  async cleanup(now: Date) {
    await this.prisma.$transaction(async (tx) => {
      await tx.emailDelivery.updateMany({
        where: {
          OR: [
            { challenge: { consumedAt: { not: null } } },
            { challenge: { expiresAt: { lte: now } } },
            { challenge: { enrollment: { expiresAt: { lte: now } } } },
            { challenge: { userId: { not: null }, enrollment: { completedAt: { not: null } } } },
            { attempts: { gte: 5 }, status: 'RUNNING', leaseUntil: { lte: now } },
          ],
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: {
          status: 'CANCELLED',
          terminalAt: now,
          encryptedPayload: null,
          generation: { increment: 1 },
          leaseUntil: null,
        },
      });
      await tx.emailDelivery.updateMany({
        where: {
          terminalAt: { lte: new Date(now.getTime() - 86400000) },
          encryptedPayload: { not: null },
        },
        data: { encryptedPayload: null },
      });
      await tx.emailEnrollment.updateMany({
        where: { OR: [{ completedAt: { not: null } }, { expiresAt: { lte: now } }] },
        data: { username: null, email: null, passwordHash: null, managementDigest: null },
      });
      const before = new Date(now.getTime() - 7 * 86400000);
      await tx.emailDelivery.deleteMany({ where: { terminalAt: { lte: before } } });
      await tx.emailChallenge.deleteMany({ where: { expiresAt: { lte: before } } });
      await tx.emailAuthProof.deleteMany({ where: { expiresAt: { lte: before } } });
      await tx.emailEnrollment.deleteMany({ where: { expiresAt: { lte: before } } });
    });
  }
}
