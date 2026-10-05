import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Environment } from '../../src/config/environment.js';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { OAUTH_PROVIDER_REGISTRY, SessionService } from '../../src/modules/auth/index.js';
import { BackofficeService } from '../../src/modules/backoffice/index.js';
import { IncidentsService } from '../../src/modules/operations/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, FakeRealtimeProvider, seedAdult } from '../fixtures/realtime.js';

describe('operations and governance HTTP RBAC', () => {
  let app: INestApplication,
    prisma: PrismaService,
    sessions: SessionService,
    backoffice: BackofficeService,
    incidents: IncidentsService;
  beforeAll(async () => {
    installTestEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true });
    const environment = testEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true });
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(environment))
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
    incidents = ref.get(IncidentsService);
  });
  beforeEach(() => clearRealtimeFixtures(prisma));
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
    installTestEnvironment();
  });
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it('separates analyst aggregates, admin detail/control, auditor read and ordinary users', async () => {
    const admin = await seedAdult(prisma),
      analyst = await seedAdult(prisma),
      auditor = await seedAdult(prisma),
      ordinary = await seedAdult(prisma);
    await backoffice.bootstrap(admin.id);
    await prisma.backofficeRoleAssignment.createMany({
      data: [
        { id: randomUUID(), userId: analyst.id, role: 'OPERATIONS_ANALYST' },
        { id: randomUUID(), userId: auditor.id, role: 'AUDITOR' },
      ],
    });
    const tokens = Object.fromEntries(
      await Promise.all(
        [admin, analyst, auditor, ordinary].map(async (u) => [
          u.id,
          (await sessions.issue(u.id)).accessToken,
        ]),
      ),
    );
    const range = 'from=2026-09-01T00:00:00.000Z&to=2026-10-01T00:00:00.000Z';
    await request(app.getHttpServer())
      .get(`/v1/backoffice/operations/metrics?${range}`)
      .set(auth(tokens[analyst.id]!))
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/backoffice/operations/rooms')
      .set(auth(tokens[analyst.id]!))
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/backoffice/operations/rooms')
      .set(auth(tokens[admin.id]!))
      .expect(200);
    const matchingRoomId = randomUUID();
    await prisma.room.create({
      data: {
        id: matchingRoomId,
        hostUserId: admin.id,
        topic: 'Admin filter movie topic',
        cefrLevel: 'B1',
        capacity: 4,
        status: 'OPEN',
        visibility: 'PUBLIC',
        startedAt: new Date('2026-09-25'),
        endsAt: new Date('2026-09-26'),
        createdAt: new Date('2026-09-25'),
      },
    });
    const filteredRooms = await request(app.getHttpServer())
      .get(
        '/v1/backoffice/operations/rooms?q=MOVIE&status=OPEN&visibility=PUBLIC&from=2026-09-24T00%3A00%3A00.000Z',
      )
      .set(auth(tokens[admin.id]!))
      .expect(200);
    expect(filteredRooms.body.items.map((room: { id: string }) => room.id)).toContain(
      matchingRoomId,
    );
    await request(app.getHttpServer())
      .get('/v1/backoffice/operations/rooms?status=NOT_A_STATUS')
      .set(auth(tokens[admin.id]!))
      .expect(400);
    await request(app.getHttpServer())
      .get(`/v1/backoffice/operations/metrics?${range}`)
      .set(auth(tokens[ordinary.id]!))
      .expect(403);

    const incident = await incidents.observe({
      component: 'STT',
      category: 'READINESS',
      severity: 'HIGH',
      scopeType: 'GLOBAL',
      scopeKey: 'primary',
      ruleVersion: 'v1',
      reasonCode: 'PROVIDER_UNAVAILABLE',
      observedAt: new Date('2026-09-25T00:00:00.000Z'),
    });
    await request(app.getHttpServer())
      .get('/v1/backoffice/incidents')
      .set(auth(tokens[auditor.id]!))
      .expect(200);
    const trends = await request(app.getHttpServer())
      .get(`/v1/backoffice/incidents/trends?${range}`)
      .set(auth(tokens[analyst.id]!))
      .expect(200);
    expect(trends.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: 'STT',
          sampleSize: 1,
          suppressed: true,
          count: null,
        }),
      ]),
    );
    expect(trends.body.every((row: { suppressed: boolean }) => row.suppressed)).toBe(true);
    await request(app.getHttpServer())
      .post(`/v1/backoffice/incidents/${incident.id}/acknowledge`)
      .set(auth(tokens[auditor.id]!))
      .send({ clientRequestId: randomUUID(), reason: 'review' })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/backoffice/incidents/${incident.id}/acknowledge`)
      .set(auth(tokens[admin.id]!))
      .send({ clientRequestId: randomUUID(), reason: 'investigating' })
      .expect(200);

    const policy = await request(app.getHttpServer())
      .post('/v1/backoffice/governance/policies')
      .set(auth(tokens[admin.id]!))
      .send({
        category: 'OPERATIONS_METRIC',
        scopeKey: 'global',
        retentionSeconds: 86400,
        rationaleRef: 'policy-v1',
        automatic: false,
      })
      .expect(201);
    expect(policy.body.status).toBe('DRAFT');
    const policies = await request(app.getHttpServer())
      .get('/v1/backoffice/governance/policies')
      .set(auth(tokens[auditor.id]!))
      .expect(200);
    expect(policies.body.items).toHaveLength(1);
    await request(app.getHttpServer())
      .get('/v1/backoffice/governance/dry-runs')
      .set(auth(tokens[auditor.id]!))
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/backoffice/governance/dry-runs')
      .set(auth(tokens[analyst.id]!))
      .expect(403);
    await request(app.getHttpServer())
      .post('/v1/backoffice/governance/policies')
      .set(auth(tokens[auditor.id]!))
      .send({
        category: 'OPERATIONS_METRIC',
        scopeKey: 'x',
        retentionSeconds: 1,
        rationaleRef: 'x',
        automatic: false,
      })
      .expect(403);
  });

  it('rejects protected deletion categories before creating mutable policy state', async () => {
    const admin = await seedAdult(prisma);
    await backoffice.bootstrap(admin.id);
    const token = (await sessions.issue(admin.id)).accessToken;
    const response = await request(app.getHttpServer())
      .post('/v1/backoffice/governance/policies')
      .set(auth(token))
      .send({
        category: 'SAFETY_EVIDENCE',
        scopeKey: 'global',
        retentionSeconds: 1,
        rationaleRef: 'invalid',
        automatic: false,
      })
      .expect(409);
    expect(response.body.code).toBe('RETENTION_CATEGORY_PROTECTED');
    expect(await prisma.retentionPolicyVersion.count()).toBe(0);
    expect(
      await prisma.backofficeAuditEvent.count({
        where: { action: 'RETENTION_POLICY_CREATED', result: 'REJECTED' },
      }),
    ).toBe(1);
  });
});
