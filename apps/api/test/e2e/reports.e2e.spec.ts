import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import pino from 'pino';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { LOG_REDACTION } from '../../src/infrastructure/observability/log-redaction.js';
import { SessionService, OAUTH_PROVIDER_REGISTRY } from '../../src/modules/auth/index.js';
import { RoomsService, HostControlsService } from '../../src/modules/rooms/index.js';
import { REPORT_CATEGORIES } from '../../src/modules/moderation/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  realtimeEnvironment,
  FakeRealtimeProvider,
  seedAdult,
  clearRealtimeFixtures,
} from '../fixtures/realtime.js';

describe('reports HTTP on PostgreSQL', () => {
  let app: INestApplication,
    prisma: PrismaService,
    sessions: SessionService,
    rooms: RoomsService,
    host: HostControlsService,
    logger: StructuredLogger;
  let roomId: string, hostId: string, memberId: string, token: string, log: string;
  const provider = new FakeRealtimeProvider();
  beforeAll(async () => {
    installTestEnvironment(realtimeEnvironment());
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(realtimeEnvironment()))
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(provider)
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    rooms = ref.get(RoomsService);
    host = ref.get(HostControlsService);
    sessions = ref.get(SessionService);
    logger = ref.get(StructuredLogger);
    Object.assign(logger, {
      logger: pino(
        { redact: LOG_REDACTION },
        new Writable({
          write(chunk: Buffer, _encoding, callback) {
            log += chunk.toString();
            callback();
          },
        }),
      ),
    });
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    log = '';
    provider.revoked = [];
    provider.deleted = [];
    hostId = (await seedAdult(prisma)).id;
    memberId = (await seedAdult(prisma)).id;
    token = (await sessions.issue(memberId)).accessToken;
    roomId = (await rooms.create(hostId, { topic: 'Report HTTP', cefrLevel: 'B1', capacity: 3 }))
      .room.id;
    await rooms.join(memberId, roomId, { rulesAccepted: true });
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
    installTestEnvironment();
  });
  const body = () => ({
    targetUserId: hostId,
    clientRequestId: randomUUID(),
    category: 'OTHER',
    description: 'private-statement-sentinel',
  });
  const submit = (input: object = body(), auth = token, id = roomId) =>
    request(app.getHttpServer())
      .post(`/v1/rooms/${id}/reports`)
      .set('authorization', `Bearer ${auth}`)
      .send(input);
  it.each(REPORT_CATEGORIES)(
    'accepts %s and returns only the original receipt on normalized retries',
    async (category) => {
      const i = { ...body(), category };
      const first = await submit(i).expect(201);
      expect(Object.keys(first.body).sort()).toEqual(['caseId', 'id', 'submittedAt']);
      expect(Number.isNaN(Date.parse(first.body.submittedAt))).toBe(false);
      const retry = await submit({ ...i, description: `  ${i.description}  ` }).expect(201);
      expect(retry.body).toEqual(first.body);
      expect(await prisma.report.count()).toBe(1);
      expect(await prisma.safetyCase.count({ where: { id: first.body.caseId } })).toBe(1);
      expect(await prisma.roomEvent.count({ where: { reportId: first.body.id } })).toBe(1);
      expect(JSON.stringify(first.body) + log).not.toContain(i.description);
    },
  );
  it('rejects missing, invalid and revoked sessions', async () => {
    await request(app.getHttpServer()).post(`/v1/rooms/${roomId}/reports`).send(body()).expect(401);
    await submit(body(), 'invalid').expect(401);
    await sessions.revoke(await sessions.verifyAccessToken(token));
    expect((await submit().expect(401)).body.code).toBe('ACCESS_TOKEN_INVALID');
    expect(await prisma.report.count()).toBe(0);
  });
  it('uses uniform unavailable context errors and checks legitimate self reports', async () => {
    for (const [id, target] of [
      [randomUUID(), hostId],
      [roomId, randomUUID()],
    ])
      expect(
        (await submit({ ...body(), targetUserId: target }, token, id).expect(404)).body.code,
      ).toBe('REPORT_CONTEXT_NOT_FOUND');
    const outsider = (await seedAdult(prisma)).id,
      outsiderToken = (await sessions.issue(outsider)).accessToken;
    // A link/invitation claim with no persisted join fact does not grant reporting access.
    expect((await submit(body(), outsiderToken).expect(404)).body.code).toBe(
      'REPORT_CONTEXT_NOT_FOUND',
    );
    expect((await submit({ ...body(), targetUserId: memberId }).expect(400)).body.code).toBe(
      'REPORT_TARGET_INVALID',
    );
    expect(await prisma.report.count()).toBe(0);
  });
  it.each(['LEFT', 'REMOVED', 'INVITED'] as const)(
    'accepts historical reporter %s after room end and reports current or former hosts',
    async (lifecycle) => {
      const m = await prisma.roomMembership.findUniqueOrThrow({
        where: { roomId_userId: { roomId, userId: memberId } },
      });
      if (lifecycle === 'LEFT')
        await host.execute(roomId, memberId, { kind: 'leave', expectedCredentialVersion: 0 });
      else {
        await host.execute(roomId, hostId, {
          kind: 'remove',
          targetId: m.id,
          expectedCredentialVersion: 0,
        });
        if (lifecycle === 'INVITED')
          await host.execute(roomId, hostId, {
            kind: 'invite',
            targetId: m.id,
            expectedCredentialVersion: 1,
          });
      }
      await host.execute(roomId, hostId, { kind: 'end' });
      await submit().expect(201);
    },
  );
  it('returns stable conflict without modifying the first statement', async () => {
    const i = body();
    await submit(i).expect(201);
    expect((await submit({ ...i, description: 'different' }).expect(409)).body.code).toBe(
      'REPORT_REQUEST_CONFLICT',
    );
    expect((await prisma.report.findFirstOrThrow()).description).toBe(i.description);
  });
  it('validates Unicode boundaries, UUIDs, enums and untrusted identity/time fields without echoing input', async () => {
    await submit({ ...body(), description: '😀'.repeat(2000) }).expect(201);
    for (const patch of [
      { description: '😀'.repeat(2001) },
      { description: '  \t\n' },
      { description: null },
      { description: 5 },
      { category: 'FAKE' },
      { targetUserId: 'bad' },
      { clientRequestId: 'bad' },
      { reporterUserId: memberId },
      { submittedAt: '2026-01-01' },
    ]) {
      const result = await submit({ ...body(), ...patch }).expect(400);
      expect(result.body.code).toBe('VALIDATION_FAILED');
      expect(JSON.stringify(result.body)).not.toContain('private-statement-sentinel');
    }
    await submit(body(), token, 'bad-uuid').expect(400);
    expect(await prisma.report.count()).toBe(1);
  });
  it('sanitizes database failure logs and responses and does not add read/edit or punitive/provider paths', async () => {
    const i = body();
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION report_http_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-statement-sentinel SELECT secret'; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER report_http_failure BEFORE INSERT ON "Report" FOR EACH ROW EXECUTE FUNCTION report_http_fail()',
    );
    try {
      const result = await submit(i).expect(500);
      expect(result.body.code).toBe('INTERNAL_ERROR');
      logger.warn({
        event: 'privacy_probe',
        description: i.description,
        input: { description: i.description },
        accessToken: token,
      });
      expect(log).toContain('unhandled_api_error');
      expect(log).toContain('[REDACTED]');
      for (const secret of [i.description, token, 'SELECT secret'])
        expect(log + JSON.stringify(result.body)).not.toContain(secret);
      expect(await prisma.report.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER report_http_failure ON "Report"');
      await prisma.$executeRawUnsafe('DROP FUNCTION report_http_fail()');
    }
    const beforeRoom = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const before = await prisma.roomMembership.findMany({
      where: { roomId },
      orderBy: { id: 'asc' },
    });
    const saved = await submit(i).expect(201);
    const http = request(app.getHttpServer());
    for (const method of ['get', 'patch', 'delete'] as const)
      await http[method](`/v1/rooms/${roomId}/reports/${saved.body.id}`)
        .set('authorization', `Bearer ${token}`)
        .expect(404);
    await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/reports`)
      .set('authorization', `Bearer ${token}`)
      .expect(404);
    expect(await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).toEqual(beforeRoom);
    expect(
      await prisma.roomMembership.findMany({ where: { roomId }, orderBy: { id: 'asc' } }),
    ).toEqual(before);
    expect(provider.revoked).toHaveLength(0);
    expect(provider.deleted).toHaveLength(0);
    expect(await prisma.realtimeCommand.count()).toBe(0);
  });
  it('runs HTTP login → profile → create/join → leave/end → report/retry with durable evidence', async () => {
    const login = async () => {
      const auth = await request(app.getHttpServer())
        .post('/v1/auth/oauth/google/exchange')
        .send({ authorizationCode: randomUUID(), redirectUri: 'slogan://oauth/google' })
        .expect(200);
      const t = auth.body.tokens.accessToken as string;
      await request(app.getHttpServer())
        .put('/v1/me/profile')
        .set('authorization', `Bearer ${t}`)
        .send({
          displayName: 'Smoke member',
          avatarUrl: 'https://example.com/avatar.png',
          genderCode: 'prefer_not_to_say',
          nationalityCode: 'CN',
          interestCodes: ['travel'],
          cefrLevel: 'B1',
          birthYear: 2000,
          birthMonth: 1,
        })
        .expect(200);
      return { userId: auth.body.userId as string, token: t };
    };
    const owner = await login(),
      reporter = await login();
    const created = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${owner.token}`)
      .send({ topic: 'Durable report smoke', cefrLevel: 'B1', capacity: 3 })
      .expect(201);
    const id = created.body.id as string;
    await request(app.getHttpServer())
      .post(`/v1/rooms/${id}/memberships`)
      .set('authorization', `Bearer ${reporter.token}`)
      .send({ rulesAccepted: true })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${id}/leave`)
      .set('authorization', `Bearer ${reporter.token}`)
      .send({ expectedCredentialVersion: 0 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${id}/end`)
      .set('authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(200);
    const i = { ...body(), targetUserId: owner.userId };
    const first = await submit(i, reporter.token, id).expect(201),
      retry = await submit(i, reporter.token, id).expect(201);
    expect(retry.body).toEqual(first.body);
    expect(await prisma.report.count({ where: { roomId: id } })).toBe(1);
    expect(await prisma.safetyCase.count({ where: { id: first.body.caseId } })).toBe(1);
    expect(await prisma.roomEvent.count({ where: { reportId: first.body.id } })).toBe(1);
  });
});
