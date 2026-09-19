import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import pino from 'pino';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { LOG_REDACTION } from '../../src/infrastructure/observability/log-redaction.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { OAUTH_PROVIDER_REGISTRY, SessionService } from '../../src/modules/auth/index.js';
import { BackofficeService } from '../../src/modules/backoffice/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { testEnvironment, installTestEnvironment } from '../fixtures/environment.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';
import { FakeRealtimeProvider } from '../fixtures/realtime.js';

describe('backoffice HTTP with persistent roles', () => {
  let app: INestApplication,
    prisma: PrismaService,
    sessions: SessionService,
    backoffice: BackofficeService,
    log: string;
  beforeAll(async () => {
    installTestEnvironment();
    const environment = testEnvironment();
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(environment))
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(new FakeRealtimeProvider())
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
    backoffice = ref.get(BackofficeService);
    Object.assign(ref.get(StructuredLogger), {
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
    log = '';
    await clearRealtimeFixtures(prisma);
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
    installTestEnvironment();
  });
  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  it('closes ordinary user → bootstrap → auditor grant/revoke → old token denied → audit read', async () => {
    const admin = await seedAdult(prisma),
      auditor = await seedAdult(prisma),
      normal = await seedAdult(prisma);
    const adminToken = (await sessions.issue(admin.id)).accessToken;
    const auditorToken = (await sessions.issue(auditor.id)).accessToken;
    const normalToken = (await sessions.issue(normal.id)).accessToken;
    await request(app.getHttpServer()).get('/v1/backoffice/me').expect(401);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/backoffice/me')
          .set(bearer(normalToken))
          .expect(403)
      ).body.code,
    ).toBe('BACKOFFICE_ACCESS_DENIED');
    await backoffice.bootstrap(admin.id);
    const me = await request(app.getHttpServer())
      .get('/v1/backoffice/me')
      .set(bearer(adminToken))
      .expect(200);
    expect(me.body).toEqual({ userId: admin.id, roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'] });
    const command = { clientRequestId: randomUUID(), reason: 'annual access review' };
    const grant = await request(app.getHttpServer())
      .post(`/v1/backoffice/users/${auditor.id}/roles/AUDITOR/grant`)
      .set(bearer(adminToken))
      .send(command)
      .expect(200);
    expect(grant.body).toMatchObject({ userId: auditor.id, role: 'AUDITOR', active: true });
    expect(
      await request(app.getHttpServer())
        .post(`/v1/backoffice/users/${auditor.id}/roles/AUDITOR/grant`)
        .set(bearer(adminToken))
        .send(command)
        .expect(200)
        .then((r) => r.body),
    ).toEqual(grant.body);
    await request(app.getHttpServer())
      .get('/v1/backoffice/role-assignments')
      .set(bearer(auditorToken))
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/backoffice/audit-events?limit=50')
      .set(bearer(auditorToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/backoffice/users/${auditor.id}/roles/AUDITOR/revoke`)
      .set(bearer(adminToken))
      .send({ clientRequestId: randomUUID(), reason: 'review complete' })
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/backoffice/audit-events')
      .set(bearer(auditorToken))
      .expect(403);
    const audits = await request(app.getHttpServer())
      .get('/v1/backoffice/audit-events?limit=50')
      .set(bearer(adminToken))
      .expect(200);
    expect(audits.body.items.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining([
        'BACKOFFICE_BOOTSTRAPPED',
        'ROLE_GRANTED',
        'ROLE_REVOKED',
        'AUDIT_EVENTS_VIEWED',
      ]),
    );
    expect(
      await prisma.backofficeRoleAssignment.count({
        where: { userId: auditor.id, role: 'AUDITOR', revokedAt: { not: null } },
      }),
    ).toBe(1);
  });

  it('allows only safety, admin and audit roles to query content-free capability incidents', async () => {
    const admin = await seedAdult(prisma, 'Capability admin'),
      safetyOfficer = await seedAdult(prisma, 'Capability safety officer'),
      auditor = await seedAdult(prisma, 'Capability auditor'),
      analyst = await seedAdult(prisma, 'Capability analyst'),
      ordinary = await seedAdult(prisma, 'Capability ordinary user');
    await backoffice.bootstrap(admin.id);
    const tokens = Object.fromEntries(
      await Promise.all(
        [admin, safetyOfficer, auditor, analyst, ordinary].map(async (user) => [
          user.id,
          (await sessions.issue(user.id)).accessToken,
        ]),
      ),
    );
    const adminToken = tokens[admin.id]!;
    for (const [user, role] of [
      [safetyOfficer, 'SAFETY_OFFICER'],
      [auditor, 'AUDITOR'],
      [analyst, 'OPERATIONS_ANALYST'],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/v1/backoffice/users/${user.id}/roles/${role}/grant`)
        .set(bearer(adminToken))
        .send({ clientRequestId: randomUUID(), reason: 'capability incident access test' })
        .expect(200);
    }
    const incidentAt = new Date();
    await prisma.safetyCapabilityIncident.create({
      data: {
        id: randomUUID(),
        component: 'STREAMING_STT',
        errorCategory: 'PROVIDER_UNAVAILABLE',
        providerCategory: 'TEST_STT',
        activeKey: 'global:STREAMING_STT:PROVIDER_UNAVAILABLE',
        startedAt: incidentAt,
        lastObservedAt: incidentAt,
      },
    });

    for (const user of [admin, safetyOfficer, auditor]) {
      const response = await request(app.getHttpServer())
        .get('/v1/backoffice/safety-capability-incidents?component=STREAMING_STT')
        .set(bearer(tokens[user.id]!))
        .expect(200);
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toMatchObject({
        component: 'STREAMING_STT',
        errorCategory: 'PROVIDER_UNAVAILABLE',
      });
      expect(JSON.stringify(response.body)).not.toMatch(/audio|transcript|provider response/i);
    }
    for (const user of [analyst, ordinary]) {
      await request(app.getHttpServer())
        .get('/v1/backoffice/safety-capability-incidents')
        .set(bearer(tokens[user.id]!))
        .expect(403);
    }
    expect(
      await prisma.backofficeAuditEvent.count({
        where: { action: 'SAFETY_CAPABILITY_INCIDENTS_VIEWED' },
      }),
    ).toBe(3);
  });

  it('validates input, stable errors, last-admin protection and absent audit mutation routes', async () => {
    const admin = await seedAdult(prisma),
      target = await seedAdult(prisma);
    await backoffice.bootstrap(admin.id);
    const token = (await sessions.issue(admin.id)).accessToken;
    const endpoint = `/v1/backoffice/users/${target.id}/roles/SAFETY_OFFICER/grant`;
    for (const body of [
      { clientRequestId: 'bad', reason: 'x' },
      { clientRequestId: randomUUID(), reason: '' },
      { clientRequestId: randomUUID(), reason: 'x', extra: true },
      { clientRequestId: randomUUID(), reason: '😀'.repeat(501) },
    ])
      expect(
        (
          await request(app.getHttpServer())
            .post(endpoint)
            .set(bearer(token))
            .send(body)
            .expect(400)
        ).body.code,
      ).toBe('VALIDATION_FAILED');
    await request(app.getHttpServer())
      .post(`/v1/backoffice/users/${target.id}/roles/UNKNOWN/grant`)
      .set(bearer(token))
      .send({ clientRequestId: randomUUID(), reason: 'x' })
      .expect(400);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/v1/backoffice/users/${admin.id}/roles/PLATFORM_ADMIN/revoke`)
          .set(bearer(token))
          .send({ clientRequestId: randomUUID(), reason: 'cannot remove final admin' })
          .expect(409)
      ).body.code,
    ).toBe('LAST_PLATFORM_ADMIN_REQUIRED');
    expect(
      (
        await request(app.getHttpServer())
          .post(`/v1/backoffice/users/${randomUUID()}/roles/AUDITOR/grant`)
          .set(bearer(token))
          .send({ clientRequestId: randomUUID(), reason: 'x' })
          .expect(404)
      ).body.code,
    ).toBe('BACKOFFICE_USER_NOT_FOUND');
    await request(app.getHttpServer())
      .post(`/v1/backoffice/users/${target.id}/roles/OPERATIONS_ANALYST/grant`)
      .set(bearer(token))
      .send({ clientRequestId: randomUUID(), reason: '😀'.repeat(500) })
      .expect(200);
    const key = randomUUID();
    await request(app.getHttpServer())
      .post(endpoint)
      .set(bearer(token))
      .send({ clientRequestId: key, reason: 'approved' })
      .expect(200);
    expect(
      (
        await request(app.getHttpServer())
          .post(endpoint)
          .set(bearer(token))
          .send({ clientRequestId: key, reason: 'changed' })
          .expect(409)
      ).body.code,
    ).toBe('BACKOFFICE_REQUEST_CONFLICT');
    await request(app.getHttpServer())
      .get('/v1/backoffice/audit-events?cursor=broken')
      .set(bearer(token))
      .expect(400);
    await request(app.getHttpServer())
      .patch('/v1/backoffice/audit-events/anything')
      .set(bearer(token))
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .delete('/v1/backoffice/audit-events/anything')
      .set(bearer(token))
      .expect(404);

    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION backoffice_http_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private-backoffice-reason SELECT secret'; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER backoffice_http_failure BEFORE INSERT ON "BackofficeAuditEvent" FOR EACH ROW EXECUTE FUNCTION backoffice_http_fail()`,
    );
    try {
      const failed = await request(app.getHttpServer())
        .post(`/v1/backoffice/users/${target.id}/roles/AUDITOR/grant`)
        .set(bearer(token))
        .send({ clientRequestId: randomUUID(), reason: 'private-backoffice-reason' })
        .expect(500);
      expect(failed.body).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      });
      expect(JSON.stringify(failed.body)).not.toMatch(/private-backoffice-reason|SELECT secret/);
      expect(log).toContain('backoffice_request_rejected');
      expect(log).toContain('VALIDATION_FAILED');
      expect(log).toContain('BACKOFFICE_REQUEST_CONFLICT');
      expect(log).toContain('INTERNAL_ERROR');
      expect(log).not.toMatch(/private-backoffice-reason|SELECT secret/);
      expect(
        await prisma.backofficeRoleAssignment.count({
          where: { userId: target.id, role: 'AUDITOR' },
        }),
      ).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER backoffice_http_failure ON "BackofficeAuditEvent"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION backoffice_http_fail()');
    }
  });
});
