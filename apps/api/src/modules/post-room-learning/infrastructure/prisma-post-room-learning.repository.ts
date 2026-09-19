import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  KeywordSummaryView,
  VocabularyItemView,
} from '../domain/entities/post-room-learning.js';
import { PostRoomLearningError } from '../domain/errors/post-room-learning.error.js';
import type { PostRoomLearningRepository } from '../domain/ports/post-room-learning.repository.js';

@Injectable()
export class PrismaPostRoomLearningRepository implements PostRoomLearningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async summary(roomId: string, userId: string): Promise<KeywordSummaryView> {
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: {
        room: {
          select: {
            id: true,
            topic: true,
            status: true,
            postRoomKeywordsEnabled: true,
            keywordSummary: {
              include: { items: { orderBy: [{ rank: 'asc' }, { id: 'asc' }] } },
            },
          },
        },
      },
    });
    const room = membership?.room;
    if (!room || !['ENDING', 'ENDED'].includes(room.status))
      throw PostRoomLearningError.summaryNotFound();
    if (!room.postRoomKeywordsEnabled || !room.keywordSummary)
      return { roomId, topic: room.topic, status: 'DISABLED', generatedAt: null, items: [] };
    const status =
      room.keywordSummary.status === 'READY'
        ? 'READY'
        : room.keywordSummary.status === 'UNAVAILABLE'
          ? 'UNAVAILABLE'
          : 'PENDING';
    return {
      roomId,
      topic: room.keywordSummary.topicSnapshot,
      status,
      generatedAt: room.keywordSummary.generatedAt,
      items:
        status === 'READY'
          ? room.keywordSummary.items.map((item) => ({
              id: item.id,
              kind: item.kind,
              text: item.displayText,
              rank: item.rank,
            }))
          : [],
    };
  }

  async queueEnded(now: Date, deadlineSeconds: number): Promise<number> {
    const summaries = await this.prisma.roomKeywordSummary.findMany({
      where: { status: 'COLLECTING', room: { status: { in: ['ENDING', 'ENDED'] } } },
      select: { id: true },
      take: 100,
    });
    let queued = 0;
    for (const summary of summaries) {
      const changed = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.roomKeywordSummary.updateMany({
          where: { id: summary.id, status: 'COLLECTING' },
          data: { status: 'PENDING', version: { increment: 1 } },
        });
        if (!updated.count) return false;
        await tx.roomKeywordSummaryJob.upsert({
          where: { summaryId: summary.id },
          create: {
            summaryId: summary.id,
            deadlineAt: new Date(now.getTime() + deadlineSeconds * 1000),
            nextAttemptAt: now,
          },
          update: {},
        });
        return true;
      });
      if (changed) queued += 1;
    }
    return queued;
  }

  async claimJobs(now: Date, leaseSeconds: number) {
    const candidates = await this.prisma.roomKeywordSummaryJob.findMany({
      where: {
        OR: [
          { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
          { status: 'RUNNING', lockedUntil: { lte: now } },
        ],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: 25,
      select: { id: true },
    });
    const claimed = [];
    for (const candidate of candidates) {
      const lease = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "RoomKeywordSummaryJob"
            WHERE "id"=${candidate.id}::uuid
              AND (("status" IN ('PENDING','FAILED') AND "nextAttemptAt" <= ${now})
                OR ("status"='RUNNING' AND "lockedUntil" <= ${now}))
            FOR UPDATE SKIP LOCKED`,
        );
        if (!locked.length) return null;
        const leaseId = randomUUID();
        return tx.roomKeywordSummaryJob.update({
          where: { id: candidate.id },
          data: {
            status: 'RUNNING',
            attempts: { increment: 1 },
            leaseId,
            lockedUntil: new Date(now.getTime() + leaseSeconds * 1000),
          },
          include: { summary: { select: { roomId: true } } },
        });
      });
      if (lease)
        claimed.push({
          id: lease.id,
          summaryId: lease.summaryId,
          roomId: lease.summary.roomId,
          leaseId: lease.leaseId!,
          deadlineAt: lease.deadlineAt,
        });
    }
    return claimed;
  }

  async completeJob(input: Parameters<PostRoomLearningRepository['completeJob']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.roomKeywordSummaryJob.findUnique({ where: { id: input.job.id } });
      const summary = await tx.roomKeywordSummary.findUnique({
        where: { id: input.job.summaryId },
      });
      if (
        !job ||
        !summary ||
        job.status !== 'RUNNING' ||
        job.leaseId !== input.job.leaseId ||
        (job.lockedUntil?.getTime() ?? 0) <= input.now.getTime()
      )
        return false;
      if (summary.status === 'READY' || summary.status === 'UNAVAILABLE') return true;
      await tx.roomKeywordSummaryItem.createMany({
        data: input.candidates.map((candidate, index) => ({
          summaryId: summary.id,
          ...candidate,
          rank: index + 1,
        })),
        skipDuplicates: true,
      });
      await tx.roomKeywordSummary.update({
        where: { id: summary.id },
        data: {
          status: 'READY',
          generatedAt: input.now,
          failureCategory: null,
          failureObservedAt: null,
          version: { increment: 1 },
        },
      });
      await tx.roomKeywordSummaryJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: input.now,
          leaseId: null,
          lockedUntil: null,
          lastError: null,
        },
      });
      return true;
    });
  }

  async failJob(input: Parameters<PostRoomLearningRepository['failJob']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.roomKeywordSummaryJob.findUnique({ where: { id: input.job.id } });
      const summary = await tx.roomKeywordSummary.findUnique({
        where: { id: input.job.summaryId },
      });
      if (!job || !summary || job.status !== 'RUNNING' || job.leaseId !== input.job.leaseId)
        return false;
      const terminal = input.terminal || input.now >= job.deadlineAt;
      if (terminal && summary.status !== 'READY') {
        await tx.roomKeywordSummary.update({
          where: { id: summary.id },
          data: {
            status: 'UNAVAILABLE',
            failureCategory: input.errorCategory,
            failureObservedAt: input.now,
            version: { increment: 1 },
          },
        });
      }
      await tx.roomKeywordSummaryJob.update({
        where: { id: job.id },
        data: terminal
          ? {
              status: 'COMPLETED',
              completedAt: input.now,
              leaseId: null,
              lockedUntil: null,
              lastError: input.errorCategory,
            }
          : {
              status: 'FAILED',
              nextAttemptAt: new Date(
                input.now.getTime() + Math.min(60_000, 1_000 * 2 ** job.attempts),
              ),
              leaseId: null,
              lockedUntil: null,
              lastError: input.errorCategory,
            },
      });
      return true;
    });
  }

  async importItem(input: Parameters<PostRoomLearningRepository['importItem']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const command = await tx.vocabularyCommand.findUnique({
        where: {
          userId_clientRequestId: { userId: input.userId, clientRequestId: input.clientRequestId },
        },
        include: { resultItem: true },
      });
      if (command) {
        if (command.payloadHash !== input.payloadHash)
          throw PostRoomLearningError.idempotencyConflict();
        if (!command.resultItem) throw PostRoomLearningError.itemNotFound();
        return this.item(command.resultItem);
      }
      const source = await tx.roomKeywordSummaryItem.findFirst({
        where: {
          id: input.sourceSummaryItemId,
          summary: {
            status: 'READY',
            room: {
              status: { in: ['ENDING', 'ENDED'] },
              memberships: { some: { userId: input.userId } },
            },
          },
        },
      });
      if (!source) throw PostRoomLearningError.summaryNotFound();
      const existing = await tx.vocabularyItem.findUnique({
        where: {
          userId_sourceSummaryItemId: { userId: input.userId, sourceSummaryItemId: source.id },
        },
      });
      const result =
        existing ??
        (await tx.vocabularyItem.create({
          data: {
            userId: input.userId,
            kind: source.kind,
            displayText: source.displayText,
            normalizedText: source.normalizedText,
            sourceSummaryItemId: source.id,
          },
        }));
      await tx.vocabularyCommand.create({
        data: {
          userId: input.userId,
          clientRequestId: input.clientRequestId,
          action: 'IMPORT',
          payloadHash: input.payloadHash,
          resultItemId: result.id,
        },
      });
      return this.item(result);
    });
  }

  async listItems(input: Parameters<PostRoomLearningRepository['listItems']>[0]) {
    const rows = await this.prisma.vocabularyItem.findMany({
      where: {
        userId: input.userId,
        ...(input.favorite === null ? {} : { favorite: input.favorite }),
        ...(input.kind === null ? {} : { kind: input.kind }),
        ...(input.cursor
          ? {
              OR: [
                { updatedAt: { lt: input.cursor.updatedAt } },
                { updatedAt: input.cursor.updatedAt, id: { lt: input.cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.item(row)),
      nextCursor:
        rows.length > input.limit && last
          ? {
              updatedAt: last.updatedAt,
              id: last.id,
              favorite: input.favorite,
              kind: input.kind,
            }
          : null,
    };
  }

  async updateItem(input: Parameters<PostRoomLearningRepository['updateItem']>[0]) {
    const updated = await this.prisma.vocabularyItem.updateMany({
      where: { id: input.itemId, userId: input.userId, version: input.expectedVersion },
      data: {
        ...(input.displayText === undefined ? {} : { displayText: input.displayText }),
        ...(input.normalizedText === undefined ? {} : { normalizedText: input.normalizedText }),
        ...(input.note === undefined ? {} : { note: input.note }),
        ...(input.favorite === undefined ? {} : { favorite: input.favorite }),
        version: { increment: 1 },
      },
    });
    if (!updated.count) await this.assertItemConflict(input.userId, input.itemId);
    return this.item(
      await this.prisma.vocabularyItem.findFirstOrThrow({
        where: { id: input.itemId, userId: input.userId },
      }),
    );
  }

  async deleteItem(userId: string, itemId: string, expectedVersion: number): Promise<void> {
    const deleted = await this.prisma.vocabularyItem.deleteMany({
      where: { id: itemId, userId, version: expectedVersion },
    });
    if (!deleted.count) await this.assertItemConflict(userId, itemId);
  }

  async temporaryCandidateRoomIds(): Promise<Set<string>> {
    const rows = await this.prisma.roomKeywordSummary.findMany({
      where: { status: { in: ['COLLECTING', 'PENDING'] } },
      select: { roomId: true },
    });
    return new Set(rows.map(({ roomId }) => roomId));
  }

  async purgeTechnical(before: Date) {
    const [jobs, commands] = await this.prisma.$transaction([
      this.prisma.roomKeywordSummaryJob.deleteMany({
        where: { status: 'COMPLETED', completedAt: { lt: before } },
      }),
      this.prisma.vocabularyCommand.deleteMany({ where: { createdAt: { lt: before } } }),
    ]);
    return { jobs: jobs.count, commands: commands.count };
  }

  private async assertItemConflict(userId: string, itemId: string): Promise<never> {
    const exists = await this.prisma.vocabularyItem.findFirst({ where: { id: itemId, userId } });
    if (!exists) throw PostRoomLearningError.itemNotFound();
    throw PostRoomLearningError.versionConflict();
  }

  private item(row: {
    id: string;
    kind: 'KEYWORD' | 'EXPRESSION';
    displayText: string;
    note: string | null;
    favorite: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): VocabularyItemView {
    return {
      id: row.id,
      kind: row.kind,
      text: row.displayText,
      note: row.note,
      favorite: row.favorite,
      version: row.version,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
