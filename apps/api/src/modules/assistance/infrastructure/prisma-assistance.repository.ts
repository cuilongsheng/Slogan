import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Prisma, type AiUsageKind } from '../../../generated/prisma/client.js';
import type { Environment } from '../../../config/environment.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type { ExpressionOutput } from '../domain/entities/assistance.js';
import { AssistanceError } from '../domain/errors/assistance.error.js';
import type {
  AssistanceRepository,
  ReservationResult,
} from '../domain/ports/assistance.repository.js';

@Injectable()
export class PrismaAssistanceRepository implements AssistanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async reserve(input: Parameters<AssistanceRepository['reserve']>[0]): Promise<ReservationResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.userId}:${input.clientRequestId}`}, 0))`,
      );
      const previous = await tx.aiExpressionRequest.findUnique({
        where: {
          userId_clientRequestId: {
            userId: input.userId,
            clientRequestId: input.clientRequestId,
          },
        },
      });
      if (previous) {
        if (
          previous.roomId !== input.roomId ||
          previous.inputMode !== input.mode ||
          previous.inputDigest !== input.digest
        )
          throw new AssistanceError(
            'ASSISTANCE_REQUEST_CONFLICT',
            'Assistance request identifier was already used',
          );
        if (previous.status === 'SUCCEEDED') {
          if (
            !previous.output ||
            !previous.outputExpiresAt ||
            previous.outputExpiresAt <= input.now
          )
            return { kind: 'EXPIRED' };
          return {
            kind: 'REPLAY',
            result: this.result(
              previous.id,
              previous.output,
              previous.finishedAt!,
              previous.outputExpiresAt,
            ),
          };
        }
        if (previous.status === 'FAILED')
          return { kind: 'FAILED', errorCode: previous.errorCode ?? 'ASSISTANCE_REQUEST_FAILED' };
        if (previous.leaseExpiresAt && previous.leaseExpiresAt > input.now)
          return {
            kind: 'IN_PROGRESS',
            retryAfterSeconds: Math.max(
              1,
              Math.ceil((previous.leaseExpiresAt.getTime() - input.now.getTime()) / 1000),
            ),
          };
        const leaseToken = randomUUID();
        await tx.aiExpressionRequest.update({
          where: { id: previous.id },
          data: {
            status: 'RESERVED',
            leaseToken,
            leaseExpiresAt: this.leaseExpiry(input.now),
            errorCode: null,
          },
        });
        return { kind: 'NEW', requestId: previous.id, leaseToken };
      }

      const quotaDate = new Date(`${input.now.toISOString().slice(0, 10)}T00:00:00.000Z`);
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`assistance:user:${input.userId}:${quotaDate.toISOString()}`}, 0))`,
      );
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`assistance:platform:${quotaDate.toISOString()}`}, 0))`,
      );
      const userRequests = await tx.aiUsageLedger.count({
        where: { userId: input.userId, quotaDate, kind: 'AI_EXPRESSION' },
      });
      const userAudio = await tx.aiUsageLedger.aggregate({
        where: { userId: input.userId, quotaDate, kind: 'STT_AUDIO' },
        _sum: { reservedUnits: true },
      });
      const platform = await tx.aiUsageLedger.aggregate({
        where: { quotaDate },
        _sum: { reservedUnits: true },
      });
      if (userRequests >= this.config.get('ASSISTANCE_USER_DAILY_REQUESTS', { infer: true }))
        throw new AssistanceError(
          'ASSISTANCE_QUOTA_EXCEEDED',
          'Daily assistance quota is exhausted',
          { retryAfterSeconds: this.untilNextUtcDay(input.now) },
        );
      if (
        input.mode === 'AUDIO' &&
        (userAudio._sum.reservedUnits ?? 0) + input.audioReservedSeconds >
          this.config.get('ASSISTANCE_USER_DAILY_AUDIO_SECONDS', { infer: true })
      )
        throw new AssistanceError('ASSISTANCE_QUOTA_EXCEEDED', 'Daily audio quota is exhausted', {
          retryAfterSeconds: this.untilNextUtcDay(input.now),
        });
      const aiReservation = 1000;
      if (
        (platform._sum.reservedUnits ?? 0) + aiReservation + input.audioReservedSeconds >
        this.config.get('ASSISTANCE_PLATFORM_DAILY_UNITS', { infer: true })
      )
        throw new AssistanceError(
          'ASSISTANCE_QUOTA_EXCEEDED',
          'Platform assistance budget is exhausted',
          { retryAfterSeconds: this.untilNextUtcDay(input.now) },
        );

      const requestId = randomUUID();
      const leaseToken = randomUUID();
      await tx.aiExpressionRequest.create({
        data: {
          id: requestId,
          userId: input.userId,
          roomId: input.roomId,
          clientRequestId: input.clientRequestId,
          inputMode: input.mode,
          inputDigest: input.digest,
          inputSize: input.inputSize,
          leaseToken,
          leaseExpiresAt: this.leaseExpiry(input.now),
          createdAt: input.now,
          updatedAt: input.now,
          usage: {
            create: [
              {
                id: randomUUID(),
                userId: input.userId,
                kind: 'AI_EXPRESSION',
                quotaDate,
                reservedUnits: aiReservation,
              },
              ...(input.mode === 'AUDIO'
                ? [
                    {
                      id: randomUUID(),
                      userId: input.userId,
                      kind: 'STT_AUDIO' as const,
                      quotaDate,
                      reservedUnits: input.audioReservedSeconds,
                    },
                  ]
                : []),
            ],
          },
        },
      });
      return { kind: 'NEW', requestId, leaseToken };
    });
  }

  async transition(input: Parameters<AssistanceRepository['transition']>[0]): Promise<void> {
    const updated = await this.prisma.aiExpressionRequest.updateMany({
      where: {
        id: input.requestId,
        leaseToken: input.leaseToken,
        status: { in: input.from },
      },
      data: {
        status: input.to,
        ...(input.providerCategory === undefined
          ? {}
          : { providerCategory: input.providerCategory }),
        ...(input.audioDurationMs === undefined ? {} : { audioDurationMs: input.audioDurationMs }),
      },
    });
    if (!updated.count)
      throw new AssistanceError('ASSISTANCE_REQUEST_CONFLICT', 'Assistance request lease changed');
  }

  async succeed(input: Parameters<AssistanceRepository['succeed']>[0]) {
    const rows = await this.prisma.aiExpressionRequest.updateMany({
      where: { id: input.requestId, leaseToken: input.leaseToken, status: 'AI_RUNNING' },
      data: {
        status: 'SUCCEEDED',
        output: input.output as unknown as Prisma.InputJsonValue,
        outputExpiresAt: input.expiresAt,
        finishedAt: input.generatedAt,
        leaseToken: null,
        leaseExpiresAt: null,
        errorCode: null,
      },
    });
    if (!rows.count)
      throw new AssistanceError('ASSISTANCE_REQUEST_CONFLICT', 'Assistance request lease changed');
    return {
      requestId: input.requestId,
      ...input.output,
      generatedAt: input.generatedAt,
      expiresAt: input.expiresAt,
    };
  }

  async fail(input: Parameters<AssistanceRepository['fail']>[0]): Promise<void> {
    await this.prisma.aiExpressionRequest.updateMany({
      where: { id: input.requestId, leaseToken: input.leaseToken },
      data: {
        status: input.uncertain ? 'UNCERTAIN' : 'FAILED',
        errorCode: input.errorCode,
        finishedAt: input.at,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
  }

  async recordUsage(requestId: string, kind: AiUsageKind, units: number): Promise<void> {
    await this.prisma.aiUsageLedger.updateMany({
      where: { requestId, kind },
      data: { actualUnits: Math.max(0, Math.ceil(units)) },
    });
  }

  async consent(input: Parameters<AssistanceRepository['consent']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.userId}:${input.clientRequestId}`}, 0))`,
      );
      const previous = await tx.speechProcessingConsentEvent.findUnique({
        where: {
          userId_clientRequestId: {
            userId: input.userId,
            clientRequestId: input.clientRequestId,
          },
        },
      });
      if (previous) {
        if (
          previous.action !== input.action ||
          previous.noticeVersion !== input.noticeVersion ||
          previous.purpose !== input.purpose
        )
          throw new AssistanceError(
            'ASSISTANCE_REQUEST_CONFLICT',
            'Consent request identifier was already used',
          );
      } else {
        const latest = await tx.speechProcessingConsentEvent.findFirst({
          where: { userId: input.userId, purpose: input.purpose },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { createdAt: true },
        });
        const createdAt =
          latest && latest.createdAt >= input.now
            ? new Date(latest.createdAt.getTime() + 1)
            : input.now;
        await tx.speechProcessingConsentEvent.create({
          data: {
            id: randomUUID(),
            userId: input.userId,
            clientRequestId: input.clientRequestId,
            purpose: input.purpose,
            action: input.action,
            noticeVersion: input.noticeVersion,
            providerCategory: input.providerCategory,
            createdAt,
          },
        });
      }
      if (
        ['ROOM_SAFETY_DETECTION', 'POST_ROOM_KEYWORDS'].includes(input.purpose) &&
        input.action === 'REVOKE'
      )
        await this.revokeRoomSpeechAccess(
          tx,
          input.userId,
          input.clientRequestId,
          input.now,
          input.purpose as 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
        );
      return this.consentStateWith(tx, input.userId, input.purpose, input.noticeVersion);
    });
  }

  consentState(
    userId: string,
    purpose: 'AI_EXPRESSION_AUDIO' | 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
    noticeVersion: string,
  ) {
    return this.consentStateWith(this.prisma, userId, purpose, noticeVersion);
  }

  async purgeExpired(requestId?: string, now = new Date()): Promise<number> {
    const result = await this.prisma.aiExpressionRequest.updateMany({
      where: {
        ...(requestId ? { id: requestId } : {}),
        output: { not: Prisma.DbNull },
        outputExpiresAt: { lte: now },
        outputPurgedAt: null,
      },
      data: { output: Prisma.DbNull, outputExpiresAt: null, outputPurgedAt: now },
    });
    return result.count;
  }

  async pendingOutputExpiries() {
    return this.prisma.aiExpressionRequest.findMany({
      where: { output: { not: Prisma.DbNull }, outputPurgedAt: null },
      select: { id: true, outputExpiresAt: true },
      orderBy: { outputExpiresAt: 'asc' },
      take: 1000,
    }) as Promise<Array<{ id: string; outputExpiresAt: Date }>>;
  }

  private async consentStateWith(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    purpose: 'AI_EXPRESSION_AUDIO' | 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
    noticeVersion: string,
  ) {
    const event = await client.speechProcessingConsentEvent.findFirst({
      where: { userId, purpose },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      purpose,
      noticeVersion: event?.noticeVersion ?? null,
      providerCategory: event?.providerCategory ?? null,
      status:
        event?.action === 'ACCEPT' && event.noticeVersion === noticeVersion
          ? ('ACCEPTED' as const)
          : event?.action === 'REVOKE'
            ? ('REVOKED' as const)
            : ('REQUIRED' as const),
      changedAt: event?.createdAt ?? null,
    };
  }

  private async revokeRoomSpeechAccess(
    tx: Prisma.TransactionClient,
    userId: string,
    clientRequestId: string,
    now: Date,
    purpose: 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
  ): Promise<void> {
    const memberships = await tx.roomMembership.findMany({
      where: {
        userId,
        lifecycle: 'ACTIVE',
        room: {
          status: 'OPEN',
          ...(purpose === 'ROOM_SAFETY_DETECTION'
            ? { sensitiveSpeechDetectionEnabled: true }
            : { postRoomKeywordsEnabled: true }),
        },
      },
      include: { room: true, realtimeIdentities: { where: { revokedAt: null } } },
    });
    for (const membership of memberships) {
      await tx.roomMembership.update({
        where: { id: membership.id },
        data: {
          lifecycle: 'LEFT',
          leftAt: now,
          presence: 'DISCONNECTED',
          providerSessionSid: null,
          credentialVersion: { increment: 1 },
        },
      });
      for (const identity of membership.realtimeIdentities) {
        await tx.realtimeIdentity.update({
          where: { identity: identity.identity },
          data: { revokedAt: now },
        });
        await tx.realtimeCommand.upsert({
          where: { key: `speech-consent:${purpose}:${clientRequestId}:${identity.identity}` },
          create: {
            key: `speech-consent:${purpose}:${clientRequestId}:${identity.identity}`,
            roomId: membership.roomId,
            type: 'REVOKE_IDENTITY',
            identity: identity.identity,
            stateVersion: membership.room.stateVersion,
            nextAttemptAt: now,
          },
          update: {},
        });
      }
      if (membership.room.hostUserId === userId) {
        const successor = await tx.roomMembership.findFirst({
          where: {
            roomId: membership.roomId,
            lifecycle: 'ACTIVE',
            user: { status: 'ACTIVE' },
          },
          orderBy: [{ joinOrder: 'asc' }, { id: 'asc' }],
        });
        if (successor) {
          await tx.room.update({
            where: { id: membership.roomId },
            data: { hostUserId: successor.userId, stateVersion: { increment: 1 } },
          });
          await tx.roomMembership.update({
            where: { id: successor.id },
            data: { role: 'HOST' },
          });
        } else {
          await tx.room.update({
            where: { id: membership.roomId },
            data: {
              status: 'ENDED',
              endedAt: now,
              endedReason: 'CONSENT_WITHDRAWN_NO_SUCCESSOR',
              stateVersion: { increment: 1 },
            },
          });
        }
      }
      await tx.roomEvent.create({
        data: {
          roomId: membership.roomId,
          type: 'speech_consent_withdrawn',
          source: 'http',
          actorId: membership.id,
          targetId: membership.id,
          reason: purpose,
          result: 'DISCONNECTED',
          occurredAt: now,
        },
      });
    }
  }

  private leaseExpiry(now: Date): Date {
    return new Date(
      now.getTime() + this.config.get('ASSISTANCE_LEASE_SECONDS', { infer: true }) * 1000,
    );
  }

  private untilNextUtcDay(now: Date): number {
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
  }

  private result(id: string, output: Prisma.JsonValue, generatedAt: Date, expiresAt: Date) {
    return {
      requestId: id,
      ...(output as unknown as ExpressionOutput),
      generatedAt,
      expiresAt,
    };
  }
}
