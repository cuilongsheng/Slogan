import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { OAUTH_PROVIDER_REGISTRY, SessionService } from '../../src/modules/auth/index.js';
import { BackofficeService } from '../../src/modules/backoffice/index.js';
import { SafetyRunner } from '../../src/modules/safety/infrastructure/safety-runner.service.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import {
  clearRealtimeFixtures,
  FakeRealtimeProvider,
  realtimeEnvironment,
  seedAdult,
} from '../fixtures/realtime.js';

describe('safety case restriction HTTP flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let backoffice: BackofficeService;
  const provider = new FakeRealtimeProvider();

  beforeAll(async () => {
    const environment = realtimeEnvironment();
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(environment))
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(provider)
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .overrideProvider(SafetyRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
    backoffice = ref.get(BackofficeService);
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    provider.tokenCalls = 0;
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });

  const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

  it('closes report → review → restriction → appeal → lift → restored room access', async () => {
    const admin = await seedAdult(prisma, 'Admin safety officer');
    const target = await seedAdult(prisma, 'Reported member');
    const reporter = await seedAdult(prisma, 'Reporter');
    const alternateHost = await seedAdult(prisma, 'Alternate host');
    await backoffice.bootstrap(admin.id);
    const adminToken = (await sessions.issue(admin.id)).accessToken;
    const targetToken = (await sessions.issue(target.id)).accessToken;
    const reporterToken = (await sessions.issue(reporter.id)).accessToken;
    const alternateHostToken = (await sessions.issue(alternateHost.id)).accessToken;

    const sourceRoom = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(bearer(targetToken))
      .send({ topic: 'Safety source room', cefrLevel: 'B1', capacity: 4 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${sourceRoom.body.id}/memberships`)
      .set(bearer(reporterToken))
      .send({ rulesAccepted: true })
      .expect(201);
    const reportBody = {
      targetUserId: target.id,
      clientRequestId: randomUUID(),
      category: 'HARASSMENT_ABUSE',
      description: 'private-e2e-report-sentinel',
    };
    const accepted = await request(app.getHttpServer())
      .post(`/v1/rooms/${sourceRoom.body.id}/reports`)
      .set(bearer(reporterToken))
      .send(reportBody)
      .expect(201);
    const retried = await request(app.getHttpServer())
      .post(`/v1/rooms/${sourceRoom.body.id}/reports`)
      .set(bearer(reporterToken))
      .send({ ...reportBody, description: `  ${reportBody.description} ` })
      .expect(201);
    expect(retried.body).toEqual(accepted.body);
    expect(accepted.body.caseId).toEqual(expect.any(String));

    const cases = await request(app.getHttpServer())
      .get(`/v1/backoffice/safety/cases?targetUserId=${target.id}`)
      .set(bearer(adminToken))
      .expect(200);
    expect(cases.body.items).toHaveLength(1);
    expect(cases.body.items[0]).toMatchObject({
      id: accepted.body.caseId,
      status: 'OPEN',
      assigneeUserId: admin.id,
    });
    const evidence = await request(app.getHttpServer())
      .get(`/v1/backoffice/safety/cases/${accepted.body.caseId}/evidence`)
      .set(bearer(adminToken))
      .expect(200);
    expect(evidence.body.report.description).toBe(reportBody.description);
    expect(JSON.stringify(evidence.body)).not.toMatch(
      /participantToken|refreshToken|providerSubject/i,
    );

    await request(app.getHttpServer())
      .post(`/v1/backoffice/safety/cases/${accepted.body.caseId}/start`)
      .set(bearer(adminToken))
      .send({ clientRequestId: randomUUID() })
      .expect(200);
    const resolutionKey = randomUUID();
    const resolved = await request(app.getHttpServer())
      .post(`/v1/backoffice/safety/cases/${accepted.body.caseId}/resolve`)
      .set(bearer(adminToken))
      .send({
        clientRequestId: resolutionKey,
        resolution: 'TEMPORARY_RESTRICTION',
        severity: 'SERIOUS',
        reason: 'confirmed in manual review',
      })
      .expect(200);
    expect(resolved.body).toMatchObject({
      case: { status: 'RESOLVED' },
      restriction: { severity: 'SERIOUS', status: 'ACTIVE' },
    });
    const resolutionRetry = await request(app.getHttpServer())
      .post(`/v1/backoffice/safety/cases/${accepted.body.caseId}/resolve`)
      .set(bearer(adminToken))
      .send({
        clientRequestId: resolutionKey,
        resolution: 'TEMPORARY_RESTRICTION',
        severity: 'SERIOUS',
        reason: '  confirmed in manual review ',
      })
      .expect(200);
    expect(resolutionRetry.body).toEqual(resolved.body);

    const blockedCreate = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(bearer(targetToken))
      .send({ topic: 'Blocked room', cefrLevel: 'B1', capacity: 3 })
      .expect(403);
    expect(blockedCreate.body).toMatchObject({
      code: 'ROOM_ACCOUNT_RESTRICTED',
      details: { severity: 'SERIOUS', endsAt: resolved.body.restriction.endsAt },
    });
    const joinRoom = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(bearer(alternateHostToken))
      .send({ topic: 'Blocked join target', cefrLevel: 'B1', capacity: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${joinRoom.body.id}/memberships`)
      .set(bearer(targetToken))
      .send({ rulesAccepted: true })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${sourceRoom.body.id}/realtime-credentials`)
      .set(bearer(targetToken))
      .send({})
      .expect(403);
    expect(provider.tokenCalls).toBe(0);
    expect(await prisma.realtimeIssuance.count()).toBe(0);

    const startsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await request(app.getHttpServer())
      .post('/v1/appointment-rooms')
      .set(bearer(targetToken))
      .send({
        topic: 'Blocked appointment',
        cefrLevel: 'B1',
        capacity: 3,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(403);
    const appointment = await request(app.getHttpServer())
      .post('/v1/appointment-rooms')
      .set(bearer(alternateHostToken))
      .send({
        topic: 'Blocked reservation target',
        cefrLevel: 'B1',
        capacity: 3,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/appointment-rooms/${appointment.body.id}/reservations`)
      .set(bearer(targetToken))
      .send({ expectedReservationVersion: 0, rulesAccepted: true })
      .expect(403);

    const own = await request(app.getHttpServer())
      .get('/v1/me/safety-restrictions')
      .set(bearer(targetToken))
      .expect(200);
    expect(Object.keys(own.body.items[0]).sort()).toEqual([
      'appealDeadlineAt',
      'appealStatus',
      'endsAt',
      'id',
      'reason',
      'severity',
      'startsAt',
      'status',
    ]);
    expect(JSON.stringify(own.body)).not.toContain(reporter.id);
    expect(JSON.stringify(own.body)).not.toContain(admin.id);
    const appealKey = randomUUID();
    const appeal = await request(app.getHttpServer())
      .post(`/v1/me/safety-restrictions/${resolved.body.restriction.id}/appeal`)
      .set(bearer(targetToken))
      .send({ clientRequestId: appealKey, reason: 'Please review the context' })
      .expect(200);
    const appealRetry = await request(app.getHttpServer())
      .post(`/v1/me/safety-restrictions/${resolved.body.restriction.id}/appeal`)
      .set(bearer(targetToken))
      .send({ clientRequestId: appealKey, reason: '  Please review the context  ' })
      .expect(200);
    expect(appealRetry.body).toEqual(appeal.body);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/me/safety-restrictions')
          .set(bearer(targetToken))
          .expect(200)
      ).body.items[0],
    ).toMatchObject({ status: 'ACTIVE', appealStatus: 'PENDING' });
    const appeals = await request(app.getHttpServer())
      .get('/v1/backoffice/safety/appeals?status=PENDING')
      .set(bearer(adminToken))
      .expect(200);
    expect(appeals.body.items.map((item: { id: string }) => item.id)).toContain(appeal.body.id);
    await request(app.getHttpServer())
      .post(`/v1/backoffice/safety/appeals/${appeal.body.id}/decide`)
      .set(bearer(adminToken))
      .send({ clientRequestId: randomUUID(), decision: 'LIFTED', reason: 'appeal accepted' })
      .expect(200);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/me/safety-restrictions')
          .set(bearer(targetToken))
          .expect(200)
      ).body.items[0],
    ).toMatchObject({ status: 'LIFTED', appealStatus: 'LIFTED' });

    await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(bearer(targetToken))
      .send({ topic: 'Access restored', cefrLevel: 'B1', capacity: 3 })
      .expect(201);
    expect(
      await prisma.backofficeAuditEvent.count({ where: { result: 'SUCCEEDED' } }),
    ).toBeGreaterThanOrEqual(8);
    const caseAudits = await request(app.getHttpServer())
      .get('/v1/backoffice/audit-events?action=SAFETY_CASE_CREATED')
      .set(bearer(adminToken))
      .expect(200);
    expect(caseAudits.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'SAFETY_CASE_CREATED' })]),
    );
    await request(app.getHttpServer())
      .get('/v1/backoffice/audit-events?action=UNKNOWN_SAFETY_ACTION')
      .set(bearer(adminToken))
      .expect(400);
  });

  it('uses current roles despite an old token and keeps rejected audits free of request bodies', async () => {
    const admin = await seedAdult(prisma, 'Admin safety officer');
    const target = await seedAdult(prisma, 'Target');
    const reporter = await seedAdult(prisma, 'Reporter');
    await backoffice.bootstrap(admin.id);
    const adminToken = (await sessions.issue(admin.id)).accessToken;
    const targetToken = (await sessions.issue(target.id)).accessToken;
    const reporterToken = (await sessions.issue(reporter.id)).accessToken;
    const room = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(bearer(targetToken))
      .send({ topic: 'Current role test', cefrLevel: 'B1', capacity: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/memberships`)
      .set(bearer(reporterToken))
      .send({ rulesAccepted: true })
      .expect(201);
    const accepted = await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/reports`)
      .set(bearer(reporterToken))
      .send({
        targetUserId: target.id,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'rejected-audit-private-body',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/backoffice/users/${admin.id}/roles/SAFETY_OFFICER/revoke`)
      .set(bearer(adminToken))
      .send({ clientRequestId: randomUUID(), reason: 'role rotation' })
      .expect(200);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/v1/backoffice/safety/cases/${accepted.body.caseId}/start`)
          .set(bearer(adminToken))
          .send({ clientRequestId: randomUUID() })
          .expect(403)
      ).body.code,
    ).toBe('SAFETY_ACCESS_DENIED');
    const rejected = await prisma.backofficeAuditEvent.findFirstOrThrow({
      where: { action: 'SAFETY_REVIEW_STARTED', result: 'REJECTED' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(rejected.actorRoles).toEqual(['PLATFORM_ADMIN']);
    expect(JSON.stringify(rejected)).not.toMatch(
      /rejected-audit-private-body|description|requestBody/i,
    );
    await request(app.getHttpServer())
      .get('/v1/backoffice/safety/cases')
      .set(bearer(adminToken))
      .expect(200);
  });
});
