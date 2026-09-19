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

describe('room discovery, share and extension HTTP contract', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let hostToken: string;
  let memberToken: string;
  let memberId: string;

  beforeAll(async () => {
    installTestEnvironment();
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    const host = await seedAdult(prisma, 'HTTP Discovery Host');
    const member = await seedAdult(prisma, 'HTTP Discovery Member');
    memberId = member.id;
    hostToken = (await sessions.issue(host.id)).accessToken;
    memberToken = (await sessions.issue(member.id)).accessToken;
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });

  const create = (body: object, token = hostToken) =>
    request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${token}`)
      .send(body);

  it('keeps old creates public and excludes link-only rooms from filtered discovery', async () => {
    const visible = await create({
      topic: 'Backend English',
      cefrLevel: 'B1',
      capacity: 4,
    }).expect(201);
    const hidden = await create({
      topic: 'Backend Hidden',
      cefrLevel: 'B1',
      capacity: 4,
      visibility: 'LINK_ONLY',
    }).expect(201);
    expect(visible.body).toMatchObject({ visibility: 'PUBLIC' });
    expect(hidden.body).toMatchObject({ visibility: 'LINK_ONLY' });
    expect(visible.body.shareUrl).toMatch(/^http:\/\/localhost:5173\/rooms\//);

    const list = await request(app.getHttpServer())
      .get('/v1/rooms?cefrLevel=B1&topic=%20BACKEND%20')
      .set('authorization', `Bearer ${hostToken}`)
      .expect(200);
    expect(list.body.items.map((room: { id: string }) => room.id)).toContain(visible.body.id);
    expect(list.body.items.map((room: { id: string }) => room.id)).not.toContain(hidden.body.id);
  });

  it('resolves a minimal share projection without authentication or side effects', async () => {
    const created = await create({
      topic: 'Protected shared room',
      cefrLevel: 'B2',
      capacity: 2,
      password: '1234',
      visibility: 'LINK_ONLY',
    }).expect(201);
    const shareCode = new URL(created.body.shareUrl).pathname.split('/').at(-1)!;
    const before = {
      memberships: await prisma.roomMembership.count(),
      reservations: await prisma.roomReservation.count(),
      identities: await prisma.realtimeIdentity.count(),
    };
    const resolved = await request(app.getHttpServer())
      .get(`/v1/room-links/${shareCode}`)
      .expect(200);
    expect(Object.keys(resolved.body).sort()).toEqual(
      [
        'availableCount',
        'capacity',
        'cefrLevel',
        'endsAt',
        'hostDisplayName',
        'id',
        'kind',
        'memberCount',
        'passwordProtected',
        'postRoomKeywordsEnabled',
        'reservedCount',
        'sensitiveSpeechDetectionEnabled',
        'startsAt',
        'status',
        'topic',
        'visibility',
      ].sort(),
    );
    expect(resolved.body).toMatchObject({ passwordProtected: true, visibility: 'LINK_ONLY' });
    expect({
      memberships: await prisma.roomMembership.count(),
      reservations: await prisma.roomReservation.count(),
      identities: await prisma.realtimeIdentity.count(),
    }).toEqual(before);

    await request(app.getHttpServer()).post(`/v1/rooms/${created.body.id}/memberships`).expect(401);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/memberships`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ rulesAccepted: true })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/memberships`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ rulesAccepted: false, password: '1234' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/realtime-credentials`)
      .set('authorization', `Bearer ${memberToken}`)
      .expect(503);
  });

  it('extends through the unified endpoint and returns durable provider status', async () => {
    const created = await create({ topic: 'HTTP extension', cefrLevel: 'C1', capacity: 4 }).expect(
      201,
    );
    const requestId = randomUUID();
    const extended = await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/extensions`)
      .set('authorization', `Bearer ${hostToken}`)
      .send({ clientRequestId: requestId, additionalMinutes: 15 })
      .expect(200);
    expect(extended.body).toMatchObject({
      roomId: created.body.id,
      extensionCount: 1,
      remainingExtensions: 2,
      providerStatus: 'COMPLETED',
    });
    expect(Date.parse(extended.body.endsAt) - Date.parse(extended.body.previousEndsAt)).toBe(
      900_000,
    );
    const replay = await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/extensions`)
      .set('authorization', `Bearer ${hostToken}`)
      .send({ clientRequestId: requestId, additionalMinutes: 15 })
      .expect(200);
    expect(replay.body.endsAt).toBe(extended.body.endsAt);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/extensions`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ clientRequestId: randomUUID(), additionalMinutes: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/extensions`)
      .set('authorization', `Bearer ${hostToken}`)
      .send({ clientRequestId: randomUUID(), additionalMinutes: 61 })
      .expect(400);
  });

  it('returns stable missing and unavailable share errors', async () => {
    await request(app.getHttpServer()).get(`/v1/room-links/${randomUUID()}`).expect(404);
    await request(app.getHttpServer()).get('/v1/room-links/not-a-uuid').expect(400);
    const created = await create({ topic: 'Ended link', cefrLevel: 'A1', capacity: 4 }).expect(201);
    const shareCode = new URL(created.body.shareUrl).pathname.split('/').at(-1)!;
    await prisma.room.update({ where: { id: created.body.id }, data: { status: 'ENDED' } });
    const unavailable = await request(app.getHttpServer())
      .get(`/v1/room-links/${shareCode}`)
      .expect(410);
    expect(unavailable.body.code).toBe('ROOM_SHARE_UNAVAILABLE');
  });

  it('enforces current-host and lifecycle conflicts through the extension API', async () => {
    const created = await create({ topic: 'Host boundary', cefrLevel: 'B1', capacity: 4 }).expect(
      201,
    );
    const host = await prisma.room.findUniqueOrThrow({ where: { id: created.body.id } });
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/memberships`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ rulesAccepted: true })
      .expect(201);
    await prisma.$transaction([
      prisma.roomMembership.update({
        where: { roomId_userId: { roomId: created.body.id, userId: host.hostUserId } },
        data: { role: 'MEMBER' },
      }),
      prisma.roomMembership.update({
        where: { roomId_userId: { roomId: created.body.id, userId: memberId } },
        data: { role: 'HOST' },
      }),
      prisma.room.update({ where: { id: created.body.id }, data: { hostUserId: memberId } }),
    ]);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/extensions`)
      .set('authorization', `Bearer ${hostToken}`)
      .send({ clientRequestId: randomUUID(), additionalMinutes: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${created.body.id}/extensions`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ clientRequestId: randomUUID(), additionalMinutes: 1 })
      .expect(200);

    for (const status of ['ENDING', 'ENDED', 'CANCELLED'] as const) {
      await prisma.room.update({ where: { id: created.body.id }, data: { status } });
      const response = await request(app.getHttpServer())
        .post(`/v1/rooms/${created.body.id}/extensions`)
        .set('authorization', `Bearer ${memberToken}`)
        .send({ clientRequestId: randomUUID(), additionalMinutes: 1 })
        .expect(409);
      expect(response.body.code).toBe('ROOM_EXTENSION_NOT_AVAILABLE');
    }
    await request(app.getHttpServer())
      .post(`/v1/rooms/${randomUUID()}/extensions`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ clientRequestId: randomUUID(), additionalMinutes: 1 })
      .expect(404);

    const appointment = await request(app.getHttpServer())
      .post('/v1/appointment-rooms')
      .set('authorization', `Bearer ${memberToken}`)
      .send({
        topic: 'Scheduled boundary',
        cefrLevel: 'B1',
        capacity: 3,
        startsAt: new Date(Date.now() + 600_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .expect(201);
    const scheduled = await request(app.getHttpServer())
      .post(`/v1/rooms/${appointment.body.id}/extensions`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ clientRequestId: randomUUID(), additionalMinutes: 1 })
      .expect(409);
    expect(scheduled.body.code).toBe('ROOM_EXTENSION_NOT_AVAILABLE');
  });
});
