import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { BackofficeService } from '../../src/modules/backoffice/index.js';
import { ReportsService } from '../../src/modules/moderation/index.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { SafetyService } from '../../src/modules/safety/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, realtimeEnvironment, seedAdult } from '../fixtures/realtime.js';

describe('safety recovery while Redis restarts', () => {
  let ref: TestingModule;
  let prisma: PrismaService;

  afterAll(async () => {
    if (prisma) await clearRealtimeFixtures(prisma);
    if (ref) await ref.close();
  });

  it('releases access from PostgreSQL time and later converges the stale projection', async () => {
    const environment = realtimeEnvironment();
    installTestEnvironment(environment);
    ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(environment))
      .compile();
    await ref.init();
    prisma = ref.get(PrismaService);
    await clearRealtimeFixtures(prisma);
    const rooms = ref.get(RoomsService);
    const reports = ref.get(ReportsService);
    const backoffice = ref.get(BackofficeService);
    const safety = ref.get(SafetyService);

    const officer = await seedAdult(prisma, 'Redis smoke officer');
    const target = await seedAdult(prisma, 'Redis smoke target');
    const reporter = await seedAdult(prisma, 'Redis smoke reporter');
    await backoffice.bootstrap(officer.id);
    const room = await rooms.create(target.id, {
      topic: 'Redis recovery source',
      cefrLevel: 'B1',
      capacity: 3,
    });
    await rooms.join(reporter.id, room.room.id, { rulesAccepted: true });
    const receipt = await reports.submit({
      roomId: room.room.id,
      reporterUserId: reporter.id,
      targetUserId: target.id,
      clientRequestId: randomUUID(),
      category: 'OTHER',
      description: 'runtime recovery fixture',
    });
    await safety.start({ userId: officer.id, roles: [] }, receipt.caseId, randomUUID());
    const resolved = (await safety.resolve({
      actor: { userId: officer.id, roles: [] },
      caseId: receipt.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'GENERAL',
      reason: 'runtime expiry fixture',
    })) as { restriction: { id: string } };
    const endsAt = new Date(Date.now() + 1_000);
    await prisma.safetyRestriction.update({
      where: { id: resolved.restriction.id },
      data: { endsAt },
    });

    await new Promise((resolve) => setTimeout(resolve, 1_250));
    expect(
      (await prisma.safetyRestriction.findUniqueOrThrow({ where: { id: resolved.restriction.id } }))
        .status,
    ).toBe('ACTIVE');
    await rooms.create(target.id, {
      topic: 'Allowed while expiry projection is stale',
      cefrLevel: 'B1',
      capacity: 3,
    });

    const deadline = Date.now() + 25_000;
    let status = 'ACTIVE';
    while (Date.now() < deadline && status === 'ACTIVE') {
      await new Promise((resolve) => setTimeout(resolve, 500));
      status = (
        await prisma.safetyRestriction.findUniqueOrThrow({ where: { id: resolved.restriction.id } })
      ).status;
    }
    expect(status).toBe('EXPIRED');
    expect(
      await prisma.backofficeAuditEvent.count({
        where: {
          actorType: 'SYSTEM_JOB',
          action: 'SAFETY_RESTRICTION_EXPIRED',
          targetId: resolved.restriction.id,
        },
      }),
    ).toBe(1);
  }, 35_000);
});
