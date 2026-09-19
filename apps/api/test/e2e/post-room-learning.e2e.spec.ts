import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('post-room keyword summary and vocabulary HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: { id: string; token: string };
  let other: { id: string; token: string };
  let roomId: string;
  let sourceSummaryItemId: string;

  beforeAll(async () => {
    installTestEnvironment();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
    const sessions = moduleRef.get(SessionService);
    const userRecord = await seedAdult(prisma, 'Vocabulary HTTP user');
    const otherRecord = await seedAdult(prisma, 'Vocabulary HTTP other');
    user = { id: userRecord.id, token: (await sessions.issue(userRecord.id)).accessToken };
    other = { id: otherRecord.id, token: (await sessions.issue(otherRecord.id)).accessToken };
  });

  beforeEach(async () => {
    await prisma.vocabularyCommand.deleteMany();
    await prisma.vocabularyItem.deleteMany();
    await prisma.roomKeywordSummaryJob.deleteMany();
    await prisma.roomKeywordSummaryItem.deleteMany();
    await prisma.roomKeywordSummary.deleteMany();
    await prisma.roomMembership.deleteMany();
    await prisma.room.deleteMany();
    const room = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: user.id,
        topic: 'Finished travel practice',
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
            userId: user.id,
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
            topicSnapshot: 'Finished travel practice',
            extractorVersion: '2026-09-v1',
            generatedAt: new Date(),
            items: {
              create: {
                kind: 'KEYWORD',
                displayText: 'itinerary',
                normalizedText: 'itinerary',
                rank: 1,
              },
            },
          },
        },
      },
      include: { keywordSummary: { include: { items: true } } },
    });
    roomId = room.id;
    sourceSummaryItemId = room.keywordSummary!.items[0]!.id;
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });

  const auth = (subject = user) => ({ authorization: `Bearer ${subject.token}` });

  it('returns a minimal member-only summary envelope', async () => {
    const result = await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/keyword-summary`)
      .set(auth())
      .expect(200);
    expect(result.body).toMatchObject({
      roomId,
      topic: 'Finished travel practice',
      status: 'READY',
      items: [{ id: sourceSummaryItemId, kind: 'KEYWORD', text: 'itinerary', rank: 1 }],
    });
    expect(JSON.stringify(result.body)).not.toMatch(/userId|membership|participant|transcript/);
    await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/keyword-summary`)
      .set(auth(other))
      .expect(404);
  });

  it('supports idempotent import, private filtered listing, versioned update and deletion', async () => {
    const command = { clientRequestId: randomUUID(), sourceSummaryItemId };
    const imported = await request(app.getHttpServer())
      .post('/v1/me/vocabulary-items')
      .set(auth())
      .send(command)
      .expect(201);
    const retried = await request(app.getHttpServer())
      .post('/v1/me/vocabulary-items')
      .set(auth())
      .send(command)
      .expect(201);
    expect(retried.body.id).toBe(imported.body.id);
    await request(app.getHttpServer())
      .put(`/v1/me/vocabulary-items/${imported.body.id}`)
      .set(auth())
      .send({ expectedVersion: 1, text: 'Detailed itinerary', favorite: true, note: 'Review' })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ version: 2, favorite: true }));
    const list = await request(app.getHttpServer())
      .get('/v1/me/vocabulary-items?favorite=true&kind=KEYWORD')
      .set(auth())
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/me/vocabulary-items')
          .set(auth(other))
          .expect(200)
      ).body.items,
    ).toEqual([]);
    await request(app.getHttpServer())
      .delete(`/v1/me/vocabulary-items/${imported.body.id}`)
      .set(auth())
      .send({ expectedVersion: 2 })
      .expect(204);
    expect(
      (await request(app.getHttpServer()).get('/v1/me/vocabulary-items').set(auth()).expect(200))
        .body.items,
    ).toEqual([]);
  });
});
