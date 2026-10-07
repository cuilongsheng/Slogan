import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { seedAdult, clearRealtimeFixtures } from '../fixtures/realtime.js';

describe('room text messages and ranges HTTP with PostgreSQL', () => {
  let app: INestApplication, prisma: PrismaService, sessions: SessionService, rooms: RoomsService;
  let roomId: string, hostId: string, memberId: string, hostToken: string, memberToken: string;
  beforeAll(async () => {
    installTestEnvironment();
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
    rooms = ref.get(RoomsService);
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    hostId = (await seedAdult(prisma, 'Host')).id;
    memberId = (await seedAdult(prisma, 'Member')).id;
    hostToken = (await sessions.issue(hostId)).accessToken;
    memberToken = (await sessions.issue(memberId)).accessToken;
    roomId = (
      await rooms.create(hostId, {
        topic: 'Range chat',
        cefrLevelMin: 'B1',
        cefrLevelMax: 'B2',
        capacity: 4,
      })
    ).room.id;
    await rooms.join(memberId, roomId, { rulesAccepted: true });
  });
  afterAll(async () => {
    await app.close();
    installTestEnvironment();
  });
  const send = (text: string, clientRequestId = randomUUID(), token = hostToken) =>
    request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .send({ text, clientRequestId });
  const read = (token = memberToken, query: Record<string, string | number> = {}) =>
    request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/messages`)
      .set('authorization', `Bearer ${token}`)
      .query(query);
  it('shares persisted text between members and deduplicates concurrent retries', async () => {
    const id = randomUUID();
    const responses = await Promise.all([
      send('  Hello 世界  ', id).expect(200),
      send('Hello 世界', id).expect(200),
    ]);
    expect(responses[0]!.body.id).toBe(responses[1]!.body.id);
    expect(responses[0]!.body).toMatchObject({
      text: 'Hello 世界',
      senderUserId: hostId,
      senderDisplayName: 'Host',
    });
    const first = await read().expect(200);
    expect(first.body.items).toHaveLength(1);
    await send('Reply', randomUUID(), memberToken).expect(200);
    const delta = await read(hostToken, { cursor: first.body.nextCursor }).expect(200);
    expect(delta.body.items.map((item: { text: string }) => item.text)).toEqual(['Reply']);
    expect(await prisma.aiExpressionRequest.count()).toBe(0);
    await send('Changed body', id).expect(409);
  });
  it('validates text, limits sends and bounds cursors', async () => {
    for (const text of [' ', '\u0000', 'a'.repeat(1001)]) await send(text).expect(400);
    for (let i = 0; i < 5; i++) await send(`message ${i}`).expect(200);
    expect((await send('too fast').expect(429)).body.code).toBe('ROOM_MESSAGE_RATE_LIMITED');
    await send('Reply', randomUUID(), memberToken).expect(200);
    const first = await read(memberToken, { limit: 2 }).expect(200);
    expect(first.body.items.map((item: { text: string }) => item.text)).toEqual([
      'message 4',
      'Reply',
    ]);
    const bad = Buffer.from(JSON.stringify({ roomId, sequence: '9999999999999999999' })).toString(
      'base64url',
    );
    await read(memberToken, { cursor: bad }).expect(400);
  });
  it('denies outsiders and former members and purges text on room close', async () => {
    const outsider = (await sessions.issue((await seedAdult(prisma)).id)).accessToken;
    await send('secret').expect(200);
    await read(outsider).expect(403);
    await send('outsider', randomUUID(), outsider).expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/leave`)
      .set('authorization', `Bearer ${memberToken}`)
      .send({ expectedCredentialVersion: 0 })
      .expect(200);
    await read().expect(403);
    await send('left', randomUUID(), memberToken).expect(403);
    await rooms.join(memberId, roomId, { rulesAccepted: true });
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId: memberId } },
      data: { lifecycle: 'REMOVED' },
    });
    await read().expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/leave`)
      .set('authorization', `Bearer ${hostToken}`)
      .send({ expectedCredentialVersion: 0 })
      .expect(200);
    await read(hostToken).expect(409);
    await send('closed').expect(409);
    expect(await prisma.roomTextMessage.count({ where: { roomId } })).toBe(0);
  });
  it('round trips ranges and legacy requests and preserves personal CEFR', async () => {
    const detail = await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}`)
      .set('authorization', `Bearer ${hostToken}`)
      .expect(200);
    expect(detail.body.room ?? detail.body).toMatchObject({
      cefrLevelMin: 'B1',
      cefrLevelMax: 'B2',
    });
    const create = (body: object) =>
      request(app.getHttpServer())
        .post('/v1/rooms')
        .set('authorization', `Bearer ${hostToken}`)
        .send(body);
    const legacy = await create({ topic: 'Legacy', cefrLevel: 'B1', capacity: 4 }).expect(201);
    expect(legacy.body).toMatchObject({ cefrLevel: 'B1', cefrLevelMin: 'B1', cefrLevelMax: 'B1' });
    await create({ topic: 'Invalid', cefrLevelMin: 'C1', cefrLevelMax: 'A2', capacity: 4 }).expect(
      400,
    );
    const scheduled = await request(app.getHttpServer())
      .post('/v1/appointment-rooms')
      .set('authorization', `Bearer ${hostToken}`)
      .send({
        topic: 'Scheduled',
        cefrLevelMin: 'B1',
        cefrLevelMax: 'B2',
        capacity: 4,
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        endsAt: new Date(Date.now() + 7200000).toISOString(),
      })
      .expect(201);
    expect(scheduled.body).toMatchObject({ cefrLevelMin: 'B1', cefrLevelMax: 'B2' });
    const code = (await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).shareCode;
    const shared = await request(app.getHttpServer()).get(`/v1/room-links/${code}`).expect(200);
    expect(shared.body).toMatchObject({ cefrLevelMin: 'B1', cefrLevelMax: 'B2' });
    expect(
      (await prisma.userProfile.findUniqueOrThrow({ where: { userId: hostId } })).cefrLevel,
    ).toBe('B1');
  });
});
