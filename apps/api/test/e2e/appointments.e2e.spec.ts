import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';
import { installTestEnvironment } from '../fixtures/environment.js';

describe('appointment HTTP contract and authorization', () => {
  let app: INestApplication, prisma: PrismaService, sessions: SessionService;
  let owner: string, member: string, ownerToken: string, memberToken: string, id: string;
  const data = () => ({
    topic: 'Appointment HTTP',
    cefrLevel: 'B1',
    capacity: 3,
    startsAt: new Date(Date.now() + 600_000).toISOString(),
    endsAt: new Date(Date.now() + 3600_000).toISOString(),
    password: '1234',
  });
  const post = (path: string, body: object, token = memberToken) =>
    request(app.getHttpServer())
      .post(`/v1/${path}`)
      .set('authorization', `Bearer ${token}`)
      .send(body);
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
    owner = (await seedAdult(prisma)).id;
    member = (await seedAdult(prisma)).id;
    ownerToken = (await sessions.issue(owner)).accessToken;
    memberToken = (await sessions.issue(member)).accessToken;
    id = (await post('appointment-rooms', data(), ownerToken).expect(201)).body.id as string;
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });
  it('returns only public fields and caller reservation on create/list/detail', async () => {
    const result = await request(app.getHttpServer())
      .get(`/v1/appointment-rooms/${id}`)
      .set('authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(result.body).toMatchObject({
      reservation: null,
      passwordProtected: true,
      memberCount: 0,
      reservedCount: 1,
    });
    expect(result.body.passwordDigest).toBeUndefined();
    expect(result.body.reservations).toBeUndefined();
    const list = await request(app.getHttpServer())
      .get('/v1/appointment-rooms?limit=1')
      .set('authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.items[0].reservation).toMatchObject({ status: 'BOOKED', version: 1 });
    await request(app.getHttpServer()).get(`/v1/appointment-rooms/${id}`).expect(401);
  });
  it('checks passwords, cancels reservations, and rejects stale versions', async () => {
    const path = `appointment-rooms/${id}`;
    await post(`${path}/reservations`, {
      rulesAccepted: true,
      expectedReservationVersion: 0,
      password: '9999',
    }).expect(403);
    const booked = await post(`${path}/reservations`, {
      rulesAccepted: true,
      expectedReservationVersion: 0,
      password: '1234',
    }).expect(201);
    expect(Object.keys(booked.body).sort()).toEqual(['id', 'status', 'version']);
    await post(`${path}/reservation-cancellations`, { expectedReservationVersion: 1 }).expect(200);
    await post(`${path}/reservations`, {
      rulesAccepted: true,
      expectedReservationVersion: 2,
      password: '1234',
    }).expect(201);
    await post(`${path}/reservation-cancellations`, { expectedReservationVersion: 1 }).expect(409);
  });
  it('does not grant membership or reporting rights from booking alone', async () => {
    await post(`appointment-rooms/${id}/reservations`, {
      rulesAccepted: true,
      password: '1234',
      expectedReservationVersion: 0,
    }).expect(201);
    const response = await post(`rooms/${id}/reports`, {
      targetUserId: owner,
      clientRequestId: randomUUID(),
      category: 'OTHER',
      description: 'Only booked',
    });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('REPORT_CONTEXT_NOT_FOUND');
    expect(await prisma.report.count()).toBe(0);
    await post(`rooms/${id}/memberships`, { rulesAccepted: true, password: '1234' }).expect(409);
  });
  it('supports host cancellation and denies ordinary members', async () => {
    await post(`appointment-rooms/${id}/cancellations`, {}).expect(403);
    await post(`appointment-rooms/${id}/cancellations`, {}, ownerToken).expect(200);
    await post(`appointment-rooms/${id}/cancellations`, {}, ownerToken).expect(200);
  });
  it.each(['2026-09-13T10:00:00', 'invalid', '2000-01-01T00:00:00Z'])(
    'rejects invalid or past date %s',
    async (startsAt) => {
      await post('appointment-rooms', { ...data(), startsAt }, ownerToken).expect(400);
    },
  );
});
