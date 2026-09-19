import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { PostRoomLearningService } from '../../src/modules/post-room-learning/index.js';
import {
  POST_ROOM_LEARNING_REPOSITORY,
  type PostRoomLearningRepository,
} from '../../src/modules/post-room-learning/domain/ports/post-room-learning.repository.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';
import { installTestEnvironment } from '../fixtures/environment.js';

describe('post-room learning persistence', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let service: PostRoomLearningService;
  let repository: PostRoomLearningRepository;
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    installTestEnvironment();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(PostRoomLearningService);
    repository = moduleRef.get(POST_ROOM_LEARNING_REPOSITORY);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    userId = (await seedAdult(prisma, 'Learning user')).id;
    otherId = (await seedAdult(prisma, 'Other user')).id;
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await moduleRef.close();
  });

  async function readySummary() {
    const room = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: userId,
        topic: 'Travel English',
        cefrLevel: 'B1',
        capacity: 3,
        status: 'ENDED',
        startedAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(Date.now() - 3_600_000),
        endedAt: new Date(),
        postRoomKeywordsEnabled: true,
        memberships: {
          create: {
            id: randomUUID(),
            userId,
            role: 'HOST',
            lifecycle: 'LEFT',
            joinOrder: 1,
            rulesVersion: 'v1',
            rulesAcceptedAt: new Date(),
            joinedAt: new Date(),
            participantIdentity: randomUUID(),
          },
        },
        keywordSummary: {
          create: {
            status: 'READY',
            topicSnapshot: 'Travel English',
            extractorVersion: '2026-09-v1',
            generatedAt: new Date(),
            items: {
              create: [
                {
                  kind: 'KEYWORD',
                  displayText: 'itinerary',
                  normalizedText: 'itinerary',
                  rank: 1,
                },
                {
                  kind: 'EXPRESSION',
                  displayText: 'local recommendation',
                  normalizedText: 'local recommendation',
                  rank: 2,
                },
              ],
            },
          },
        },
      },
      include: { keywordSummary: { include: { items: true } } },
    });
    return room;
  }

  it('protects summary reads by actual membership and exposes only final allowed fields', async () => {
    const room = await readySummary();
    const summary = await service.getSummary(userId, room.id);

    expect(summary).toMatchObject({ status: 'READY', topic: 'Travel English' });
    expect(summary.items.map(({ text }) => text)).toEqual(['itinerary', 'local recommendation']);
    expect(JSON.stringify(summary)).not.toMatch(
      /userId|membership|participant|transcript|timeline/,
    );
    await expect(service.getSummary(otherId, room.id)).rejects.toMatchObject({
      code: 'KEYWORD_SUMMARY_NOT_FOUND',
    });
  });

  it('imports idempotently, paginates by filter, edits by version and physically deletes', async () => {
    const room = await readySummary();
    const source = room.keywordSummary!.items.find(({ kind }) => kind === 'KEYWORD')!;
    const request = { clientRequestId: randomUUID(), sourceSummaryItemId: source.id };
    const first = await service.importItem(userId, request);
    const retry = await service.importItem(userId, request);
    expect(retry.id).toBe(first.id);
    await expect(
      service.importItem(userId, { ...request, sourceSummaryItemId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });

    const updated = await service.updateItem(userId, first.id, {
      expectedVersion: 1,
      text: 'Detailed itinerary',
      note: 'review tomorrow',
      favorite: true,
    });
    expect(updated).toMatchObject({ text: 'Detailed itinerary', favorite: true, version: 2 });
    await expect(
      service.updateItem(userId, first.id, { expectedVersion: 1, favorite: false }),
    ).rejects.toMatchObject({ code: 'VOCABULARY_VERSION_CONFLICT' });
    const page = await service.listItems(userId, { favorite: true, kind: 'KEYWORD', limit: 1 });
    expect(page.items).toHaveLength(1);
    expect((await service.listItems(otherId, {})).items).toEqual([]);

    await service.deleteItem(userId, first.id, 2);
    expect(await prisma.vocabularyItem.count()).toBe(0);
    expect(await prisma.roomKeywordSummaryItem.count()).toBe(2);
    await expect(service.deleteItem(userId, first.id, 2)).rejects.toMatchObject({
      code: 'VOCABULARY_ITEM_NOT_FOUND',
    });
  });

  it('claims one durable job and commits READY content only for the active lease', async () => {
    const room = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: userId,
        topic: 'Job room',
        cefrLevel: 'B1',
        capacity: 2,
        status: 'ENDED',
        startedAt: new Date(Date.now() - 7_200_000),
        endsAt: new Date(Date.now() - 3_600_000),
        endedAt: new Date(),
        postRoomKeywordsEnabled: true,
        keywordSummary: {
          create: { topicSnapshot: 'Job room', extractorVersion: '2026-09-v1' },
        },
      },
    });
    const now = new Date();
    expect(await repository.queueEnded(now, 600)).toBe(1);
    const [first, second] = await Promise.all([
      repository.claimJobs(now, 30),
      repository.claimJobs(now, 30),
    ]);
    const leases = [...first, ...second];
    expect(leases).toHaveLength(1);
    expect(leases[0]!.roomId).toBe(room.id);
    await expect(
      repository.completeJob({
        job: { ...leases[0]!, leaseId: randomUUID() },
        candidates: [{ kind: 'KEYWORD', displayText: 'recovery', normalizedText: 'recovery' }],
        now,
      }),
    ).resolves.toBe(false);
    await expect(
      repository.completeJob({
        job: leases[0]!,
        candidates: [{ kind: 'KEYWORD', displayText: 'recovery', normalizedText: 'recovery' }],
        now,
      }),
    ).resolves.toBe(true);
    expect(await repository.queueEnded(now, 600)).toBe(0);
    expect(await prisma.roomKeywordSummaryItem.count()).toBe(1);
  });
});
