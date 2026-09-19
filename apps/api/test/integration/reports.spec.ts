import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { RoomsService, HostControlsService } from '../../src/modules/rooms/index.js';
import { ReportsService, type ReportInput } from '../../src/modules/moderation/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('reports PostgreSQL atomicity and history', () => {
  let ref: TestingModule,
    prisma: PrismaService,
    rooms: RoomsService,
    host: HostControlsService,
    reports: ReportsService;
  let hostId: string, memberId: string, roomId: string;
  beforeAll(async () => {
    installTestEnvironment();
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = ref.get(PrismaService);
    rooms = ref.get(RoomsService);
    host = ref.get(HostControlsService);
    reports = ref.get(ReportsService);
    await prisma.$connect();
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    hostId = (await seedAdult(prisma)).id;
    memberId = (await seedAdult(prisma)).id;
    roomId = (await rooms.create(hostId, { topic: 'Reports tests', capacity: 3, cefrLevel: 'B1' }))
      .room.id;
    await rooms.join(memberId, roomId, { rulesAccepted: true });
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });
  const input = (): ReportInput => ({
    roomId,
    reporterUserId: memberId,
    targetUserId: hostId,
    clientRequestId: randomUUID(),
    category: 'HARASSMENT_ABUSE',
    description: 'private report statement',
  });
  const member = () =>
    prisma.roomMembership.findUniqueOrThrow({
      where: { roomId_userId: { roomId, userId: memberId } },
    });
  it.each(['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'] as const)(
    'accepts retained membership lifecycle %s and closed rooms',
    async (lifecycle) => {
      if (lifecycle === 'LEFT')
        await host.execute(roomId, memberId, { kind: 'leave', expectedCredentialVersion: 0 });
      if (lifecycle === 'REMOVED' || lifecycle === 'INVITED') {
        await host.execute(roomId, hostId, {
          kind: 'remove',
          targetId: (await member()).id,
          expectedCredentialVersion: 0,
        });
        if (lifecycle === 'INVITED')
          await host.execute(roomId, hostId, {
            kind: 'invite',
            targetId: (await member()).id,
            expectedCredentialVersion: 1,
          });
      }
      for (const status of ['OPEN', 'ENDING', 'ENDED'] as const) {
        await prisma.room.update({ where: { id: roomId }, data: { status } });
        const i = input(),
          saved = await reports.submit(i);
        const report = await prisma.report.findUniqueOrThrow({ where: { id: saved.id } });
        const event = await prisma.roomEvent.findUniqueOrThrow({ where: { reportId: saved.id } });
        const safetyCase = await prisma.safetyCase.findUniqueOrThrow({
          where: { reportId: saved.id },
          include: { participants: true, activities: true },
        });
        expect(saved.caseId).toBe(safetyCase.id);
        expect(safetyCase).toMatchObject({
          reportId: saved.id,
          roomId,
          targetUserId: hostId,
          status: 'OPEN',
          assigneeUserId: null,
        });
        expect(safetyCase.participants).toHaveLength(2);
        expect(safetyCase.activities.map((activity) => activity.type).sort()).toEqual([
          'CREATED',
          'UNASSIGNED',
        ]);
        expect(report.description).toBe(i.description);
        expect(event).toMatchObject({
          roomId,
          actorId: memberId,
          targetId: hostId,
          reason: i.category,
          occurredAt: saved.submittedAt,
          result: 'SUBMITTED',
        });
        expect(JSON.stringify(event)).not.toContain(i.description);
      }
    },
  );
  it('commits one report and event under simultaneous identical requests and after connection rebuild', async () => {
    const i = input();
    const results = await Promise.all(Array.from({ length: 5 }, () => reports.submit(i)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(new Set(results.map((r) => r.caseId)).size).toBe(1);
    expect(await prisma.report.count()).toBe(1);
    expect(await prisma.safetyCase.count()).toBe(1);
    expect(await prisma.roomEvent.count({ where: { reportId: { not: null } } })).toBe(1);
    await prisma.$disconnect();
    await prisma.$connect();
    expect(await reports.submit({ ...i, description: ` ${i.description} ` })).toEqual(results[0]);
  });
  it('resolves cross-room request conflicts outside the failed transaction and isolates reporters', async () => {
    const second = (
      await rooms.create(hostId, { topic: 'Second report room', capacity: 3, cefrLevel: 'B1' })
    ).room.id;
    await rooms.join(memberId, second, { rulesAccepted: true });
    const i = input();
    const results = await Promise.allSettled([
      reports.submit(i),
      reports.submit({ ...i, roomId: second }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'REPORT_REQUEST_CONFLICT' },
    });
    const other = await reports.submit({ ...i, reporterUserId: hostId, targetUserId: memberId });
    expect(other.id).toBeDefined();
    expect(await prisma.report.count()).toBe(2);
  });
  it.each([
    'Report',
    'RoomEvent',
    'SafetyCase',
    'SafetyCaseParticipantSnapshot',
    'SafetyCaseActivity',
    'BackofficeAuditEvent',
  ])('rolls back the entire acceptance transaction when %s insertion fails', async (table) => {
    // Database trigger injects a real persistence failure, independent of application mocks.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION report_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private report statement SQL secret'; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER report_test_failure BEFORE INSERT ON "${table}" FOR EACH ROW EXECUTE FUNCTION report_test_fail()`,
    );
    try {
      await expect(reports.submit(input())).rejects.toBeDefined();
      expect(await prisma.report.count()).toBe(0);
      expect(await prisma.roomEvent.count({ where: { reportId: { not: null } } })).toBe(0);
      expect(await prisma.safetyCase.count()).toBe(0);
      expect(await prisma.safetyCaseParticipantSnapshot.count()).toBe(0);
      expect(await prisma.safetyCaseActivity.count()).toBe(0);
      expect(await prisma.backofficeAuditEvent.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER report_test_failure ON "${table}"`);
      await prisma.$executeRawUnsafe('DROP FUNCTION report_test_fail()');
    }
  });
  it('enforces FK, length, self-report, audit uniqueness and RESTRICT deletion defenses', async () => {
    const i = input(),
      saved = await reports.submit(i);
    for (const patch of [
      { targetUserId: randomUUID() },
      { targetUserId: memberId },
      { description: '' },
      { description: '😀'.repeat(2001) },
    ])
      await expect(
        prisma.report.create({ data: { ...i, ...patch, clientRequestId: randomUUID() } }),
      ).rejects.toBeDefined();
    const event = await prisma.roomEvent.findUniqueOrThrow({ where: { reportId: saved.id } });
    await expect(
      prisma.roomEvent.create({ data: { ...event, id: randomUUID() } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.roomEvent.create({
        data: {
          type: 'report_submitted',
          source: 'http',
          result: 'SUBMITTED',
          occurredAt: new Date(),
          roomId,
        },
      }),
    ).rejects.toBeDefined();
    await expect(prisma.room.delete({ where: { id: roomId } })).rejects.toBeDefined();
    await expect(
      prisma.roomMembership.delete({ where: { id: (await member()).id } }),
    ).rejects.toBeDefined();
    expect(await prisma.report.count()).toBe(1);
  });
  it('serializes report with leave/remove/end while retaining history and has no punitive effects', async () => {
    const i = input(),
      m = await member();
    await Promise.allSettled([
      reports.submit(i),
      host.execute(roomId, memberId, { kind: 'leave', expectedCredentialVersion: 0 }),
      host.execute(roomId, hostId, {
        kind: 'remove',
        targetId: m.id,
        expectedCredentialVersion: 0,
      }),
      host.execute(roomId, hostId, { kind: 'end' }),
    ]);
    expect(await prisma.report.count()).toBe(1);
    const beforeRoom = await prisma.room.findUniqueOrThrow({ where: { id: roomId } }),
      beforeMember = await member();
    await reports.submit({ ...i, clientRequestId: randomUUID() });
    expect(await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).toEqual(beforeRoom);
    expect(await member()).toEqual(beforeMember);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: memberId } })).status).toBe(
      'ACTIVE',
    );
  });
  it('rejects self, missing reporter and missing target with no persisted report', async () => {
    const i = input();
    await expect(reports.submit({ ...i, targetUserId: memberId })).rejects.toMatchObject({
      code: 'REPORT_TARGET_INVALID',
    });
    await expect(reports.submit({ ...i, reporterUserId: randomUUID() })).rejects.toMatchObject({
      code: 'REPORT_CONTEXT_NOT_FOUND',
    });
    await expect(reports.submit({ ...i, targetUserId: randomUUID() })).rejects.toMatchObject({
      code: 'REPORT_CONTEXT_NOT_FOUND',
    });
    expect(await prisma.report.count()).toBe(0);
  });
});
