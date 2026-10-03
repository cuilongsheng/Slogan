import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../src/config/environment.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { GovernanceService, IncidentsService } from '../../src/modules/operations/index.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('operations governance PostgreSQL lifecycle', () => {
  let ref: TestingModule,
    prisma: PrismaService,
    incidents: IncidentsService,
    governance: GovernanceService;
  beforeAll(async () => {
    installTestEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true });
    ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService<Environment, true>(
          testEnvironment({ OPERATIONS_GOVERNANCE_ENABLED: true }),
        ),
      )
      .compile();
    prisma = ref.get(PrismaService);
    incidents = ref.get(IncidentsService);
    governance = ref.get(GovernanceService);
    await prisma.$connect();
  });
  beforeEach(() => clearRealtimeFixtures(prisma));
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });

  it('deduplicates an open incident, preserves occurrences and fences idempotent commands', async () => {
    const admin = await seedAdult(prisma);
    const observation = {
      component: 'POSTGRESQL',
      category: 'READINESS',
      severity: 'HIGH' as const,
      scopeType: 'GLOBAL',
      scopeKey: 'primary',
      ruleVersion: 'v1',
      reasonCode: 'CONNECTION_FAILED',
      observedAt: new Date(),
    };
    const [one, two] = await Promise.all([
      incidents.observe(observation),
      incidents.observe({
        ...observation,
        observedAt: new Date(observation.observedAt.getTime() + 1),
      }),
    ]);
    expect(one.id === two.id || (await prisma.operationalIncident.count()) === 1).toBe(true);
    expect((await prisma.operationalIncident.findFirstOrThrow()).observationCount).toBe(2);
    const request = randomUUID();
    const acknowledged = await incidents.command(
      admin.id,
      ['PLATFORM_ADMIN'],
      one.id,
      'ACKNOWLEDGE',
      'investigating',
      request,
    );
    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(
      (
        await incidents.command(
          admin.id,
          ['PLATFORM_ADMIN'],
          one.id,
          'ACKNOWLEDGE',
          'investigating',
          request,
        )
      ).id,
    ).toBe(one.id);
    await expect(
      incidents.command(admin.id, ['PLATFORM_ADMIN'], one.id, 'ACKNOWLEDGE', 'changed', request),
    ).rejects.toMatchObject({ code: 'OPERATIONS_REQUEST_CONFLICT' });
    await incidents.command(
      admin.id,
      ['PLATFORM_ADMIN'],
      one.id,
      'RESOLVE',
      'recovered',
      randomUUID(),
    );
    const recurrence = await incidents.observe({
      ...observation,
      observedAt: new Date(observation.observedAt.getTime() + 2),
    });
    expect(recurrence.occurrence).toBe(2);
    const recurrenceDelivery = await prisma.operationalAlertDelivery.findUniqueOrThrow({
      where: { incidentId: recurrence.id },
    });
    expect(recurrenceDelivery.nextAttemptAt.getTime()).toBeGreaterThan(
      observation.observedAt.getTime(),
    );
    await incidents.recover({
      component: observation.component,
      category: observation.category,
      scopeType: observation.scopeType,
      scopeKey: observation.scopeKey,
      ruleVersion: observation.ruleVersion,
      observedAt: new Date(),
    });
    expect(
      (await prisma.operationalIncident.findUniqueOrThrow({ where: { id: recurrence.id } })).status,
    ).toBe('RESOLVED');
  });

  it('requires an active purgeable policy and binds dry-run, hold and fenced batches', async () => {
    const admin = await seedAdult(prisma);
    await expect(
      governance.createPolicy(admin.id, ['PLATFORM_ADMIN'], {
        category: 'SAFETY_EVIDENCE',
        scopeKey: 'global',
        retentionSeconds: 60,
        rationaleRef: 'policy-x',
        automatic: false,
      }),
    ).rejects.toMatchObject({ code: 'RETENTION_CATEGORY_PROTECTED' });
    await prisma.operationalCommand.create({
      data: {
        id: randomUUID(),
        actorUserId: admin.id,
        clientRequestId: randomUUID(),
        action: 'ACKNOWLEDGE_INCIDENT',
        payloadHash: 'a'.repeat(64),
        result: {},
        createdAt: new Date(Date.now() - 86_400_000),
      },
    });
    const draft = await governance.createPolicy(admin.id, ['PLATFORM_ADMIN'], {
      category: 'TECHNICAL_COMMAND',
      scopeKey: 'global',
      retentionSeconds: 0,
      rationaleRef: 'policy-1',
      automatic: false,
    });
    const policy = await governance.activatePolicy(
      admin.id,
      ['PLATFORM_ADMIN'],
      draft.id,
      'approved',
    );
    expect(policy.status).toBe('ACTIVE');
    const dry = await governance.dryRun(admin.id, ['PLATFORM_ADMIN'], policy.id, randomUUID());
    expect(dry.candidateCount).toBe(1);
    const hold = await governance.createHold(admin.id, ['PLATFORM_ADMIN'], {
      category: 'TECHNICAL_COMMAND',
      startsAt: new Date(Date.now() - 1_000),
      reason: 'investigation hold',
    });
    const run = await governance.createRun(
      admin.id,
      ['PLATFORM_ADMIN'],
      dry.id,
      'DELETE APPROVED RETENTION CANDIDATES',
      randomUUID(),
    );
    expect(run.status).toBe('PENDING');
    const outcome = await governance.dispatchOne();
    expect(outcome.handled).toBe(true);
    expect((await prisma.retentionRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe(
      'COMPLETED',
    );
    expect(await prisma.operationalCommand.count()).toBe(1);
    await governance.releaseHold(admin.id, ['PLATFORM_ADMIN'], hold.id, 'investigation complete');
    const secondDry = await governance.dryRun(
      admin.id,
      ['PLATFORM_ADMIN'],
      policy.id,
      randomUUID(),
    );
    const secondRun = await governance.createRun(
      admin.id,
      ['PLATFORM_ADMIN'],
      secondDry.id,
      'DELETE APPROVED RETENTION CANDIDATES',
      randomUUID(),
    );
    await governance.dispatchOne();
    expect(
      (await prisma.retentionRun.findUniqueOrThrow({ where: { id: secondRun.id } })).deletedCount,
    ).toBe(1);
    expect(await prisma.operationalCommand.count()).toBe(0);
    const dryRuns = await governance.dryRuns(admin.id, ['PLATFORM_ADMIN'], { limit: 1 });
    expect(dryRuns.items).toHaveLength(1);
    expect(dryRuns.nextCursor).not.toBeNull();
    expect(JSON.stringify(dryRuns)).not.toMatch(/payloadHash|clientRequestId|actorUserId/);
    const runs = await governance.runs(admin.id, ['PLATFORM_ADMIN'], { limit: 20 });
    expect(JSON.stringify(runs)).not.toMatch(/payloadHash|clientRequestId|leaseId/);

    await prisma.operationalCommand.create({
      data: {
        id: randomUUID(),
        actorUserId: admin.id,
        clientRequestId: randomUUID(),
        action: 'RESOLVE_INCIDENT',
        payloadHash: 'b'.repeat(64),
        result: {},
        createdAt: new Date(Date.now() - 86_400_000),
      },
    });
    const automaticDraft = await governance.createPolicy(admin.id, ['PLATFORM_ADMIN'], {
      category: 'TECHNICAL_COMMAND',
      scopeKey: 'automatic',
      retentionSeconds: 0,
      rationaleRef: 'policy-auto',
      automatic: true,
    });
    await governance.activatePolicy(
      admin.id,
      ['PLATFORM_ADMIN'],
      automaticDraft.id,
      'approved automatic cleanup',
    );
    const automaticOutcome = await governance.dispatchOne();
    expect(automaticOutcome).toMatchObject({ handled: true, scheduled: 1 });
    expect(await prisma.operationalCommand.count()).toBe(0);
  });

  it('stores deletion and recovery evidence without locations, credentials or deleted content', async () => {
    const admin = await seedAdult(prisma);
    await governance.recordDeletion({
      category: 'TEMPORARY_SPEECH_CONTENT',
      purpose: 'TEST_LOCAL_BUFFER',
      policyVersion: 'v1',
      deadlineAt: new Date(),
      completedAt: new Date(),
      result: 'COMPLETED',
    });
    await governance.recordDeletion({
      category: 'TEMPORARY_SPEECH_CONTENT',
      purpose: 'TEST_PROVIDER_DELETION',
      providerCategory: 'FAKE_STT',
      policyVersion: 'v1',
      deadlineAt: new Date(Date.now() - 1),
      result: 'UNCERTAIN',
      reasonCode: 'PROVIDER_DELETION_UNCONFIRMED',
    });
    expect(
      await prisma.operationalIncident.count({
        where: { component: 'DELETION_EVIDENCE', status: 'OPEN' },
      }),
    ).toBe(1);
    const drill = await governance.recordRecovery(admin.id, ['PLATFORM_ADMIN'], {
      clientRequestId: randomUUID(),
      environment: 'LOCAL',
      environmentId: 'docker-isolated',
      backupDigest: 'a'.repeat(64),
      toolVersion: 'pg17',
      schemaVersion: 'migration-head',
      status: 'SUCCEEDED',
      observedRpoSeconds: 5,
      observedRtoSeconds: 10,
      checkSummary: { migrations: true },
      startedAt: new Date(Date.now() - 10_000),
      completedAt: new Date(),
    });
    expect(drill.status).toBe('SUCCEEDED');
    const serialized = JSON.stringify(
      await governance.recoveryDrills(admin.id, ['PLATFORM_ADMIN'], { limit: 20 }),
    );
    expect(serialized).not.toMatch(/postgresql:|password|backupLocation|DATABASE_URL/i);
    expect(serialized).not.toMatch(/payloadHash|clientRequestId|actorUserId/);
  });
});
