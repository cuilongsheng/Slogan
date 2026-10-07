import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  realtimeEnvironment,
  FakeRealtimeProvider,
  seedAdult,
  clearRealtimeFixtures,
  signedWebhook,
} from '../fixtures/realtime.js';

describe('realtime HTTP API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let rooms: RoomsService;
  let roomId: string;
  let token: string;
  let outsiderToken: string;
  const provider = new FakeRealtimeProvider();
  beforeAll(async () => {
    installTestEnvironment(realtimeEnvironment());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(realtimeEnvironment()))
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(provider)
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
    sessions = moduleRef.get(SessionService);
    rooms = moduleRef.get(RoomsService);
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    provider.fail = false;
    provider.revoked = [];
    provider.deleted = [];
    const host = await seedAdult(prisma, 'Host');
    const outsider = await seedAdult(prisma, 'Outsider');
    token = (await sessions.issue(host.id)).accessToken;
    outsiderToken = (await sessions.issue(outsider.id)).accessToken;
    roomId = (await rooms.create(host.id, { topic: 'HTTP realtime', cefrLevel: 'B1', capacity: 4 }))
      .room.id;
  });
  afterAll(async () => {
    await app.close();
    installTestEnvironment();
  });
  const credential = () =>
    request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/realtime-credentials`)
      .set('authorization', `Bearer ${token}`);
  it('requires authentication and current room membership', async () => {
    await request(app.getHttpServer()).post(`/v1/rooms/${roomId}/realtime-credentials`).expect(401);
    const rejected = await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/realtime-credentials`)
      .set('authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    expect(rejected.body.code).toBe('ROOM_MEMBERSHIP_REQUIRED');
    await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/members`)
      .set('authorization', `Bearer ${outsiderToken}`)
      .expect(403);
  });
  it('returns the documented minimal credential and member payloads', async () => {
    const issued = await credential().expect(200);
    expect(Object.keys(issued.body).sort()).toEqual(
      [
        'expiresAt',
        'participantIdentity',
        'participantToken',
        'roomId',
        'serverUrl',
        'lifecycle',
        'role',
        'credentialVersion',
        'hostReconnectDeadline',
      ].sort(),
    );
    const members = await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/members`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(members.body).toHaveLength(1);
    expect(Object.keys(members.body[0]).sort()).toEqual(
      [
        'membershipId',
        'userId',
        'lifecycle',
        'credentialVersion',
        'hostReconnectDeadline',
        'displayName',
        'avatarUrl',
        'nationalityCode',
        'cefrLevel',
        'role',
        'position',
        'presence',
        'participantIdentity',
      ].sort(),
    );
    expect(members.body[0].participantIdentity).toBe(issued.body.participantIdentity);
  });
  it('accepts signed raw webhooks, handles repeats once, and preserves JSON endpoints', async () => {
    const issued = await credential().expect(200);
    const id = randomUUID();
    const body = JSON.stringify({
      event: 'participant_joined',
      id,
      createdAt: Math.floor(Date.now() / 1000),
      room: { name: `room-${roomId}`, sid: 'RM_test' },
      participant: { identity: issued.body.participantIdentity, sid: 'PA_1' },
    });
    const signature = await signedWebhook(body);
    for (let i = 0; i < 2; i++)
      await request(app.getHttpServer())
        .post('/v1/webhooks/livekit')
        .set('content-type', 'application/webhook+json')
        .set('authorization', signature)
        .send(body)
        .expect(204);
    expect(await prisma.roomEvent.count({ where: { providerEventId: id } })).toBe(1);
    const members = await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/members`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(members.body[0].presence).toBe('CONNECTED');
    await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${token}`)
      .send({ topic: 'JSON still works', cefrLevel: 'B1', capacity: 4 })
      .expect(201);
  });
  it('rejects changed bytes, missing signatures and user tokens on the provider route', async () => {
    const body = JSON.stringify({
      event: 'room_finished',
      id: randomUUID(),
      createdAt: Math.floor(Date.now() / 1000),
      room: { name: `room-${roomId}`, sid: 'RM_test' },
    });
    const signature = await signedWebhook(body);
    for (const [raw, auth] of [
      [body + ' ', signature],
      [body, `Bearer ${token}`],
      [body, ''],
    ]) {
      const response = await request(app.getHttpServer())
        .post('/v1/webhooks/livekit')
        .set('content-type', 'application/webhook+json')
        .set('authorization', auth!)
        .send(raw!)
        .expect(401);
      expect(response.body.code).toBe('REALTIME_WEBHOOK_INVALID');
    }
    expect(await prisma.roomEvent.count()).toBe(0);
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('OPEN');
  });
  it('rejects expiration and invalid room identifiers', async () => {
    await request(app.getHttpServer())
      .post('/v1/rooms/not-uuid/realtime-credentials')
      .set('authorization', `Bearer ${token}`)
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${randomUUID()}/realtime-credentials`)
      .set('authorization', `Bearer ${token}`)
      .expect(404);
    await prisma.room.update({ where: { id: roomId }, data: { endsAt: new Date(Date.now() - 1) } });
    const response = await credential().expect(409);
    expect(response.body.code).toBe('ROOM_ENDED');
  });
  it('maps provider failures without disclosing provider messages', async () => {
    const original = provider.ensureRoom;
    provider.ensureRoom = async () => {
      const { RealtimeError } = await import('../../src/modules/voice/index.js');
      throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
    };
    try {
      const response = await credential().expect(503);
      expect(response.body.code).toBe('REALTIME_PROVIDER_UNAVAILABLE');
    } finally {
      provider.ensureRoom = original;
    }
  });
});
