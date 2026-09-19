import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { AppointmentsService } from '../../src/modules/rooms/testing.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('room history and private note HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let rooms: RoomsService;
  let appointments: AppointmentsService;
  let userId: string;
  let otherId: string;
  let userToken: string;
  let otherToken: string;
  let endedRoomId: string;
  let reservedRoomId: string;

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
    sessions = moduleRef.get(SessionService);
    rooms = moduleRef.get(RoomsService);
    appointments = moduleRef.get(AppointmentsService);
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    userId = (await seedAdult(prisma, 'History HTTP user')).id;
    otherId = (await seedAdult(prisma, 'Other HTTP user')).id;
    userToken = (await sessions.issue(userId)).accessToken;
    otherToken = (await sessions.issue(otherId)).accessToken;

    endedRoomId = (
      await rooms.create(userId, {
        topic: 'Finished conversation',
        cefrLevel: 'B2',
        capacity: 3,
        password: '2468',
      })
    ).room.id;
    await rooms.join(otherId, endedRoomId, { rulesAccepted: true, password: '2468' });
    await prisma.room.update({ where: { id: endedRoomId }, data: { status: 'ENDED' } });

    const start = new Date(Date.now() + 600_000);
    reservedRoomId = (
      await appointments.create(otherId, {
        topic: 'Booked only',
        cefrLevel: 'B1',
        capacity: 3,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
      })
    ).id;
    await appointments.reserve(userId, reservedRoomId, {
      rulesAccepted: true,
      expectedReservationVersion: 0,
    });
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });

  const auth = (token = userToken) => ({ authorization: 'Bearer ' + token });

  it('lists only the caller history with a minimal projection and no note body', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/me/room-history?limit=20')
      .set(auth())
      .expect(200);
    expect(response.body.items).toHaveLength(2);
    expect(
      response.body.items.map((item: { relationship: string }) => item.relationship).sort(),
    ).toEqual(['PARTICIPATED', 'RESERVED_ONLY']);
    expect(Object.keys(response.body.items[0]).sort()).toEqual(
      [
        'cefrLevel',
        'endsAt',
        'kind',
        'membershipLifecycle',
        'membershipRole',
        'noteExists',
        'occurredAt',
        'relationship',
        'reservationStatus',
        'roomId',
        'startedAt',
        'status',
        'topic',
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toContain('2468');
    expect(JSON.stringify(response.body)).not.toContain('passwordDigest');
    expect(JSON.stringify(response.body)).not.toContain('participantIdentity');
    expect(JSON.stringify(response.body)).not.toContain('content');

    const other = await request(app.getHttpServer())
      .get('/v1/me/room-history')
      .set(auth(otherToken))
      .expect(200);
    expect(other.body.items).toHaveLength(2);
    await request(app.getHttpServer()).get('/v1/me/room-history').expect(401);
    await request(app.getHttpServer())
      .get('/v1/me/room-history?cursor=invalid')
      .set(auth())
      .expect(400);
  });

  it('saves, safely retries, reads and clears only the caller note', async () => {
    const path = '/v1/rooms/' + endedRoomId + '/note';
    expect((await request(app.getHttpServer()).get(path).set(auth()).expect(200)).body).toEqual({
      content: null,
      version: 0,
      updatedAt: null,
    });
    const saved = await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: 'My private reflection', expectedVersion: 0 })
      .expect(200);
    expect(saved.body).toMatchObject({ content: 'My private reflection', version: 1 });
    expect(
      (
        await request(app.getHttpServer())
          .put(path)
          .set(auth())
          .send({ content: 'My private reflection', expectedVersion: 0 })
          .expect(200)
      ).body.version,
    ).toBe(1);
    expect(
      (await request(app.getHttpServer()).get(path).set(auth(otherToken)).expect(200)).body,
    ).toEqual({ content: null, version: 0, updatedAt: null });
    const cleared = await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: ' \n ', expectedVersion: 1 })
      .expect(200);
    expect(cleared.body).toMatchObject({ content: null, version: 2 });
    await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: 'stale', expectedVersion: 0 })
      .expect(409);
  });

  it('hides rooms without actual membership and rejects notes before room end', async () => {
    await request(app.getHttpServer())
      .get('/v1/rooms/' + reservedRoomId + '/note')
      .set(auth())
      .expect(404);
    const openRoom = (
      await rooms.create(userId, { topic: 'Open room', cefrLevel: 'B1', capacity: 2 })
    ).room.id;
    await request(app.getHttpServer())
      .put('/v1/rooms/' + openRoom + '/note')
      .set(auth())
      .send({ content: 'too early', expectedVersion: 0 })
      .expect(409);
    await request(app.getHttpServer())
      .get('/v1/rooms/00000000-0000-4000-8000-000000000000/note')
      .set(auth())
      .expect(404);
  });

  it('enforces Unicode length, control character, transport and version validation', async () => {
    const path = '/v1/rooms/' + endedRoomId + '/note';
    await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: '😀'.repeat(2000), expectedVersion: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: '😀'.repeat(2001), expectedVersion: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: 'bad\u0000note', expectedVersion: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .put(path)
      .set(auth())
      .send({ content: 'bad version', expectedVersion: -1 })
      .expect(400);
    await request(app.getHttpServer())
      .put(path)
      .send({ content: 'unauthorized', expectedVersion: 0 })
      .expect(401);
  });
});
