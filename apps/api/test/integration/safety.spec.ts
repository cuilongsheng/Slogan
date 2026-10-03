import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { BackofficeService } from '../../src/modules/backoffice/index.js';
import { ReportsService } from '../../src/modules/moderation/index.js';
import { AppointmentsService, RoomsService } from '../../src/modules/rooms/index.js';
import { SafetyService } from '../../src/modules/safety/index.js';
import { PrismaSafetyRepository } from '../../src/modules/safety/infrastructure/prisma-safety.repository.js';
import { readEffectiveSafetyRestriction } from '../../src/modules/safety/persistence.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

type CaseView = { id: string; status: string; assigneeUserId: string | null; version: number };
type RestrictionView = {
  id: string;
  status: string;
  severity: string;
  startsAt: string;
  endsAt: string | null;
  appealDeadlineAt: string | null;
};
type ResolveView = { case: CaseView; restriction: RestrictionView | null };
type AppealView = { id: string; status: string; submittedAt: string };

describe('safety cases, restrictions and appeals on PostgreSQL', () => {
  let ref: TestingModule;
  let prisma: PrismaService;
  let rooms: RoomsService;
  let appointments: AppointmentsService;
  let reports: ReportsService;
  let sessions: SessionService;
  let backoffice: BackofficeService;
  let safety: SafetyService;
  let repository: PrismaSafetyRepository;

  beforeAll(async () => {
    installTestEnvironment();
    ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = ref.get(PrismaService);
    rooms = ref.get(RoomsService);
    appointments = ref.get(AppointmentsService);
    reports = ref.get(ReportsService);
    sessions = ref.get(SessionService);
    backoffice = ref.get(BackofficeService);
    safety = ref.get(SafetyService);
    repository = ref.get(PrismaSafetyRepository);
    await prisma.$connect();
  });

  beforeEach(() => clearRealtimeFixtures(prisma));

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await ref.close();
  });

  const actor = (userId: string) => ({ userId, roles: [] });

  async function grantSafety(adminId: string, userId: string) {
    await backoffice.mutateRole({
      actorUserId: adminId,
      targetUserId: userId,
      role: 'SAFETY_OFFICER',
      action: 'GRANT',
      reason: 'safety test assignment',
      clientRequestId: randomUUID(),
    });
  }

  async function createReportCase(target?: string) {
    const targetUserId = target ?? (await seedAdult(prisma)).id;
    const reporterUserId = (await seedAdult(prisma)).id;
    const roomId = (
      await rooms.create(targetUserId, {
        topic: 'Safety case evidence',
        capacity: 4,
        cefrLevel: 'B1',
      })
    ).room.id;
    await rooms.join(reporterUserId, roomId, { rulesAccepted: true });
    const receipt = await reports.submit({
      roomId,
      reporterUserId,
      targetUserId,
      clientRequestId: randomUUID(),
      category: 'HARASSMENT_ABUSE',
      description: 'private safety report text',
    });
    return { ...receipt, roomId, reporterUserId, targetUserId };
  }

  it('balances new cases, preserves unassigned cases and recovers invalid assignees', async () => {
    const admin = await seedAdult(prisma, 'Admin officer');
    const second = await seedAdult(prisma, 'Second officer');
    await backoffice.bootstrap(admin.id);
    await grantSafety(admin.id, second.id);

    const created = await Promise.all([
      createReportCase(),
      createReportCase(),
      createReportCase(),
      createReportCase(),
    ]);
    const assigned = await prisma.safetyCase.findMany({
      where: { id: { in: created.map((item) => item.caseId) } },
      orderBy: { createdAt: 'asc' },
    });
    expect(new Set(assigned.map((item) => item.assigneeUserId))).toEqual(
      new Set([admin.id, second.id]),
    );
    const loads = [admin.id, second.id].map(
      (id) => assigned.filter((item) => item.assigneeUserId === id).length,
    );
    expect(Math.abs(loads[0]! - loads[1]!)).toBeLessThanOrEqual(1);
    expect(
      await prisma.backofficeAuditEvent.count({ where: { action: 'SAFETY_CASE_ASSIGNED' } }),
    ).toBe(4);

    const invalid = assigned.find((item) => item.assigneeUserId === second.id)!;
    await backoffice.mutateRole({
      actorUserId: admin.id,
      targetUserId: second.id,
      role: 'SAFETY_OFFICER',
      action: 'REVOKE',
      reason: 'off duty',
      clientRequestId: randomUUID(),
    });
    await Promise.all([repository.recoverAssignments(), repository.recoverAssignments()]);
    expect(
      (await prisma.safetyCase.findUniqueOrThrow({ where: { id: invalid.id } })).assigneeUserId,
    ).toBe(admin.id);
    expect(
      await prisma.safetyCaseActivity.count({
        where: { caseId: invalid.id, type: 'REASSIGNED' },
      }),
    ).toBe(1);

    await clearRealtimeFixtures(prisma);
    const unassigned = await createReportCase();
    expect(
      (await prisma.safetyCase.findUniqueOrThrow({ where: { id: unassigned.caseId } }))
        .assigneeUserId,
    ).toBeNull();
    const available = await seedAdult(prisma, 'Available officer');
    await backoffice.bootstrap(available.id);
    expect(await repository.recoverAssignments()).toBe(1);
    expect(
      (await prisma.safetyCase.findUniqueOrThrow({ where: { id: unassigned.caseId } }))
        .assigneeUserId,
    ).toBe(available.id);
    expect(await repository.recoverAssignments()).toBe(0);
  });

  it('serializes claim/start/temporary resolution and enforces all room write entries', async () => {
    const pending = await createReportCase();
    const admin = await seedAdult(prisma, 'Admin officer');
    const second = await seedAdult(prisma, 'Second officer');
    await backoffice.bootstrap(admin.id);
    await grantSafety(admin.id, second.id);

    const claims = await Promise.allSettled([
      safety.claim(actor(admin.id), pending.caseId, randomUUID()),
      safety.claim(actor(second.id), pending.caseId, randomUUID()),
    ]);
    expect(claims.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(claims.filter((item) => item.status === 'rejected')).toMatchObject([
      { reason: { code: 'SAFETY_STATE_CONFLICT' } },
    ]);
    const claimed = (
      claims.find((item) => item.status === 'fulfilled') as PromiseFulfilledResult<unknown>
    ).value as CaseView;
    const officerId = claimed.assigneeUserId!;
    const otherId = officerId === admin.id ? second.id : admin.id;
    const startKey = randomUUID();
    const started = (await safety.start(actor(officerId), pending.caseId, startKey)) as CaseView;
    expect(started.status).toBe('UNDER_REVIEW');
    expect((await safety.caseSummary(actor(officerId))).open).toBe(1);
    expect(await safety.start(actor(officerId), pending.caseId, startKey)).toEqual(started);
    await expect(safety.start(actor(otherId), pending.caseId, randomUUID())).rejects.toMatchObject({
      code: 'SAFETY_STATE_CONFLICT',
    });

    const resolveKey = randomUUID();
    const resolved = (await safety.resolve({
      actor: actor(officerId),
      caseId: pending.caseId,
      clientRequestId: resolveKey,
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'GENERAL',
      reason: '  confirmed behavior  ',
    })) as ResolveView;
    expect(resolved.case.status).toBe('RESOLVED');
    expect((await safety.caseSummary(actor(officerId))).open).toBe(0);
    expect(resolved.restriction).toMatchObject({ status: 'ACTIVE', severity: 'GENERAL' });
    expect(
      new Date(resolved.restriction!.endsAt!).getTime() -
        new Date(resolved.restriction!.startsAt).getTime(),
    ).toBe(3 * 60 * 60 * 1000);
    expect(
      new Date(resolved.restriction!.appealDeadlineAt!).getTime() -
        new Date(resolved.restriction!.startsAt).getTime(),
    ).toBe(30 * 60 * 1000);
    expect(
      (
        (await safety.resolve({
          actor: actor(officerId),
          caseId: pending.caseId,
          clientRequestId: resolveKey,
          resolution: 'TEMPORARY_RESTRICTION',
          severity: 'GENERAL',
          reason: 'confirmed behavior',
        })) as ResolveView
      ).restriction,
    ).toEqual(resolved.restriction);
    await expect(
      safety.resolve({
        actor: actor(officerId),
        caseId: pending.caseId,
        clientRequestId: randomUUID(),
        resolution: 'NO_ACTION',
        reason: 'changed decision',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_STATE_CONFLICT' });
    expect(await prisma.safetyRestriction.count({ where: { caseId: pending.caseId } })).toBe(1);

    const beforeRooms = await prisma.room.count();
    await expect(
      rooms.create(pending.targetUserId, {
        topic: 'Blocked instant room',
        capacity: 3,
        cefrLevel: 'B1',
      }),
    ).rejects.toMatchObject({
      code: 'ROOM_ACCOUNT_RESTRICTED',
      details: { severity: 'GENERAL', endsAt: resolved.restriction!.endsAt },
    });
    expect(await prisma.room.count()).toBe(beforeRooms);

    const openHost = await seedAdult(prisma);
    const openRoom = (
      await rooms.create(openHost.id, { topic: 'Join target', capacity: 3, cefrLevel: 'B1' })
    ).room.id;
    await expect(
      rooms.join(pending.targetUserId, openRoom, { rulesAccepted: true }),
    ).rejects.toMatchObject({ code: 'ROOM_ACCOUNT_RESTRICTED' });
    expect(
      await prisma.roomMembership.count({
        where: { roomId: openRoom, userId: pending.targetUserId },
      }),
    ).toBe(0);

    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    await expect(
      appointments.create(pending.targetUserId, {
        topic: 'Blocked appointment',
        capacity: 3,
        cefrLevel: 'B1',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'ROOM_ACCOUNT_RESTRICTED' });
    expect(await prisma.room.count()).toBe(beforeRooms + 1);

    const appointment = await appointments.create(openHost.id, {
      topic: 'Reserve target',
      capacity: 3,
      cefrLevel: 'B1',
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
    });
    await expect(
      appointments.reserve(pending.targetUserId, appointment.id, {
        expectedReservationVersion: 0,
        rulesAccepted: true,
      }),
    ).rejects.toMatchObject({ code: 'ROOM_ACCOUNT_RESTRICTED' });
    expect(
      await prisma.roomReservation.count({
        where: { roomId: appointment.id, userId: pending.targetUserId },
      }),
    ).toBe(0);
  });

  it('keeps overlapping restrictions independent and uses database time at the expiry boundary', async () => {
    const first = await createReportCase();
    const admin = await seedAdult(prisma);
    await backoffice.bootstrap(admin.id);
    await prisma.safetyCase.update({
      where: { id: first.caseId },
      data: { assigneeUserId: admin.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });
    const second = await createReportCase(first.targetUserId);
    await prisma.safetyCase.update({
      where: { id: second.caseId },
      data: { assigneeUserId: admin.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });
    const one = (await safety.resolve({
      actor: actor(admin.id),
      caseId: first.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'GENERAL',
      reason: 'first restriction',
    })) as ResolveView;
    const two = (await safety.resolve({
      actor: actor(admin.id),
      caseId: second.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'HIGH_RISK',
      reason: 'second restriction',
    })) as ResolveView;

    const ownFirstPage = (await safety.ownRestrictions(first.targetUserId, { limit: 1 })) as {
      items: Array<{ id: string }>;
      nextCursor: string | null;
    };
    expect(ownFirstPage.items).toHaveLength(1);
    expect(ownFirstPage.nextCursor).toEqual(expect.any(String));
    const ownSecondPage = (await safety.ownRestrictions(first.targetUserId, {
      limit: 1,
      cursor: ownFirstPage.nextCursor!,
    })) as { items: Array<{ id: string }>; nextCursor: string | null };
    expect(ownSecondPage.items).toHaveLength(1);
    expect(ownSecondPage.nextCursor).toBeNull();
    expect(new Set([...ownFirstPage.items, ...ownSecondPage.items].map((item) => item.id))).toEqual(
      new Set([one.restriction!.id, two.restriction!.id]),
    );

    await prisma.$transaction(async (tx) => {
      const atFirstEnd = new Date(one.restriction!.endsAt!);
      const effective = await readEffectiveSafetyRestriction(tx, first.targetUserId, atFirstEnd);
      expect(effective).toMatchObject({
        severity: 'HIGH_RISK',
        endsAt: new Date(two.restriction!.endsAt!),
      });
      expect(effective!.restrictionIds).toEqual([two.restriction!.id]);
    });
    const liftKey = randomUUID();
    const lifted = await safety.lift(actor(admin.id), one.restriction!.id, {
      clientRequestId: liftKey,
      reason: 'early lift',
    });
    expect(
      await safety.lift(actor(admin.id), one.restriction!.id, {
        clientRequestId: liftKey,
        reason: '  early lift ',
      }),
    ).toEqual(lifted);
    expect(
      await prisma.$transaction((tx) => readEffectiveSafetyRestriction(tx, first.targetUserId)),
    ).toMatchObject({ severity: 'HIGH_RISK' });
    const concurrentLifts = await Promise.allSettled([
      safety.lift(actor(admin.id), two.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'second early lift',
      }),
      safety.lift(actor(admin.id), two.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'competing early lift',
      }),
    ]);
    expect(concurrentLifts.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(concurrentLifts.filter((item) => item.status === 'rejected')).toMatchObject([
      { reason: { code: 'SAFETY_STATE_CONFLICT' } },
    ]);
    expect(
      await prisma.$transaction((tx) => readEffectiveSafetyRestriction(tx, first.targetUserId)),
    ).toBeNull();
  });

  it('submits one appeal, keeps private ownership and atomically lifts it on approval', async () => {
    const pending = await createReportCase();
    const officer = await seedAdult(prisma);
    await backoffice.bootstrap(officer.id);
    await prisma.safetyCase.update({
      where: { id: pending.caseId },
      data: { assigneeUserId: officer.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });
    const resolved = (await safety.resolve({
      actor: actor(officer.id),
      caseId: pending.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'SERIOUS',
      reason: 'appealable restriction',
    })) as ResolveView;
    const key = randomUUID();
    const submitted = (await safety.appeal(pending.targetUserId, resolved.restriction!.id, {
      clientRequestId: key,
      reason: '  context for review  ',
    })) as AppealView;
    expect(submitted.status).toBe('PENDING');
    expect(
      await safety.appeal(pending.targetUserId, resolved.restriction!.id, {
        clientRequestId: key,
        reason: 'context for review',
      }),
    ).toEqual(submitted);
    await expect(
      safety.appeal(pending.targetUserId, resolved.restriction!.id, {
        clientRequestId: key,
        reason: 'changed appeal content',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_REQUEST_CONFLICT' });
    await expect(
      safety.appeal(pending.reporterUserId, resolved.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'not my restriction',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_RESTRICTION_NOT_FOUND' });
    await expect(
      safety.appeal(pending.targetUserId, resolved.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'second appeal',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_STATE_CONFLICT' });

    const decided = (await safety.decideAppeal(actor(officer.id), submitted.id, {
      clientRequestId: randomUUID(),
      decision: 'LIFTED',
      reason: 'appeal accepted',
    })) as AppealView;
    expect(decided.status).toBe('LIFTED');
    expect(
      await prisma.safetyRestriction.findUniqueOrThrow({ where: { id: resolved.restriction!.id } }),
    ).toMatchObject({ status: 'LIFTED', liftedByUserId: officer.id });
    expect(
      await prisma.$transaction((tx) => readEffectiveSafetyRestriction(tx, pending.targetUserId)),
    ).toBeNull();
    await expect(
      safety.appeal(pending.targetUserId, resolved.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'already lifted',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_APPEAL_CLOSED' });
    const own = (await safety.ownRestrictions(pending.targetUserId, { limit: 10 })) as {
      items: RestrictionView[];
    };
    expect(own.items).toHaveLength(1);
    expect(own.items[0]).toMatchObject({ id: resolved.restriction!.id, status: 'LIFTED' });
    expect(Object.keys(own.items[0]!).sort()).toEqual([
      'appealDeadlineAt',
      'appealStatus',
      'endsAt',
      'id',
      'reason',
      'severity',
      'startsAt',
      'status',
    ]);
    expect(JSON.stringify(own)).not.toContain(pending.reporterUserId);
    expect(JSON.stringify(own)).not.toContain(officer.id);
  });

  it('serializes first appeal and its terminal decision and audits closed-window rejection', async () => {
    const firstOfficer = await seedAdult(prisma, 'First appeal officer');
    const secondOfficer = await seedAdult(prisma, 'Second appeal officer');
    await backoffice.bootstrap(firstOfficer.id);
    await grantSafety(firstOfficer.id, secondOfficer.id);
    const pending = await createReportCase();
    await prisma.safetyCase.update({
      where: { id: pending.caseId },
      data: { assigneeUserId: firstOfficer.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });
    const resolved = (await safety.resolve({
      actor: actor(firstOfficer.id),
      caseId: pending.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'SERIOUS',
      reason: 'appeal concurrency fixture',
    })) as ResolveView;
    await prisma.safetyRestriction.update({
      where: { id: resolved.restriction!.id },
      data: { appealDeadlineAt: new Date(Date.now() - 1) },
    });
    await expect(
      safety.appeal(pending.targetUserId, resolved.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'closed-window-private-reason',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_APPEAL_CLOSED' });
    const closedAudit = await prisma.backofficeAuditEvent.findFirstOrThrow({
      where: { action: 'SAFETY_APPEAL_SUBMITTED', result: 'REJECTED' },
      orderBy: { occurredAt: 'desc' },
    });
    expect(closedAudit.details).toMatchObject({ errorCode: 'SAFETY_APPEAL_CLOSED' });
    expect(JSON.stringify(closedAudit)).not.toContain('closed-window-private-reason');

    await prisma.safetyRestriction.update({
      where: { id: resolved.restriction!.id },
      data: { appealDeadlineAt: new Date(Date.now() + 10 * 60 * 1000) },
    });
    const appealAttempts = [
      { clientRequestId: randomUUID(), reason: 'first concurrent appeal' },
      { clientRequestId: randomUUID(), reason: 'second concurrent appeal' },
    ];
    const submissions = await Promise.allSettled(
      appealAttempts.map((input) =>
        safety.appeal(pending.targetUserId, resolved.restriction!.id, input),
      ),
    );
    expect(submissions.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(submissions.filter((item) => item.status === 'rejected')).toMatchObject([
      { reason: { code: 'SAFETY_STATE_CONFLICT' } },
    ]);
    expect(
      await prisma.safetyAppeal.count({ where: { restrictionId: resolved.restriction!.id } }),
    ).toBe(1);
    const appeal = await prisma.safetyAppeal.findUniqueOrThrow({
      where: { restrictionId: resolved.restriction!.id },
    });
    const decisions = await Promise.allSettled([
      safety.decideAppeal(actor(firstOfficer.id), appeal.id, {
        clientRequestId: randomUUID(),
        decision: 'UPHELD',
        reason: 'restriction remains',
      }),
      safety.decideAppeal(actor(secondOfficer.id), appeal.id, {
        clientRequestId: randomUUID(),
        decision: 'LIFTED',
        reason: 'restriction removed',
      }),
    ]);
    expect(decisions.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(decisions.filter((item) => item.status === 'rejected')).toMatchObject([
      { reason: { code: 'SAFETY_STATE_CONFLICT' } },
    ]);
    const finalAppeal = await prisma.safetyAppeal.findUniqueOrThrow({ where: { id: appeal.id } });
    expect(['UPHELD', 'LIFTED']).toContain(finalAppeal.status);
    const finalRestriction = await prisma.safetyRestriction.findUniqueOrThrow({
      where: { id: resolved.restriction!.id },
    });
    if (finalAppeal.status === 'UPHELD') {
      expect(finalRestriction.status).toBe('ACTIVE');
      expect(finalRestriction.endsAt?.toISOString()).toBe(resolved.restriction!.endsAt);
    } else {
      expect(finalRestriction.status).toBe('LIFTED');
    }
  });

  it('expires once, emits a system audit and immediately ignores stale active projections', async () => {
    const pending = await createReportCase();
    const officer = await seedAdult(prisma);
    await backoffice.bootstrap(officer.id);
    await prisma.safetyCase.update({
      where: { id: pending.caseId },
      data: { assigneeUserId: officer.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });
    const resolved = (await safety.resolve({
      actor: actor(officer.id),
      caseId: pending.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'GENERAL',
      reason: 'shortened by fixture',
    })) as ResolveView;
    await prisma.safetyRestriction.update({
      where: { id: resolved.restriction!.id },
      data: { endsAt: new Date(Date.now() - 1) },
    });
    expect(
      await prisma.$transaction((tx) => readEffectiveSafetyRestriction(tx, pending.targetUserId)),
    ).toBeNull();
    const before = await prisma.room.count();
    await rooms.create(pending.targetUserId, {
      topic: 'Allowed after durable expiry',
      capacity: 3,
      cefrLevel: 'B1',
    });
    expect(await prisma.room.count()).toBe(before + 1);
    const results = await Promise.all([
      repository.expire(resolved.restriction!.id),
      repository.expire(resolved.restriction!.id),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(
      await prisma.safetyCaseActivity.count({
        where: { caseId: pending.caseId, type: 'RESTRICTION_EXPIRED' },
      }),
    ).toBe(1);
    expect(
      await prisma.backofficeAuditEvent.count({
        where: {
          action: 'SAFETY_RESTRICTION_EXPIRED',
          actorType: 'SYSTEM_JOB',
          targetId: resolved.restriction!.id,
        },
      }),
    ).toBe(1);
  });

  it('keeps administrators read-only unless they also hold the safety role', async () => {
    const admin = await seedAdult(prisma);
    const officer = await seedAdult(prisma);
    await backoffice.bootstrap(admin.id);
    await grantSafety(admin.id, officer.id);
    await backoffice.mutateRole({
      actorUserId: admin.id,
      targetUserId: admin.id,
      role: 'SAFETY_OFFICER',
      action: 'REVOKE',
      reason: 'separate duties',
      clientRequestId: randomUUID(),
    });
    const pending = await createReportCase();
    const listed = (await safety.listCases(actor(admin.id), { limit: 20 })) as {
      items: CaseView[];
    };
    expect(listed.items.map((item) => item.id)).toContain(pending.caseId);
    await expect(safety.claim(actor(admin.id), pending.caseId, randomUUID())).rejects.toMatchObject(
      {
        code: 'SAFETY_ACCESS_DENIED',
      },
    );
    expect(
      (await prisma.safetyCase.findUniqueOrThrow({ where: { id: pending.caseId } })).status,
    ).toBe('OPEN');
    const officerList = (await safety.listCases(actor(officer.id), { limit: 20 })) as {
      items: CaseView[];
    };
    expect(officerList.items.map((item) => item.id)).toContain(pending.caseId);
    await expect(backoffice.listAssignments(officer.id, { limit: 20 })).rejects.toMatchObject({
      code: 'BACKOFFICE_ACCESS_DENIED',
    });
  });

  it('paginates scoped case queues and returns bounded evidence in a fixed projection', async () => {
    const admin = await seedAdult(prisma, 'Admin officer');
    const second = await seedAdult(prisma, 'Second officer');
    await backoffice.bootstrap(admin.id);
    await grantSafety(admin.id, second.id);
    const created = [await createReportCase(), await createReportCase(), await createReportCase()];
    await expect(safety.caseSummary(actor(admin.id))).resolves.toEqual({
      open: 3,
      highRisk: 0,
      closed: 0,
    });
    await expect(safety.appealSummary(actor(admin.id))).resolves.toEqual({
      pending: 0,
      upheld: 0,
      lifted: 0,
    });

    const firstPage = (await safety.listCases(actor(admin.id), { limit: 2 })) as {
      items: CaseView[];
      nextCursor: string | null;
    };
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const secondPage = (await safety.listCases(actor(admin.id), {
      limit: 2,
      cursor: firstPage.nextCursor!,
    })) as { items: CaseView[]; nextCursor: string | null };
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.nextCursor).toBeNull();
    expect(new Set([...firstPage.items, ...secondPage.items].map((item) => item.id)).size).toBe(3);
    const filtered = (await safety.listCases(actor(admin.id), {
      limit: 20,
      targetUserId: created[0]!.targetUserId,
      status: 'OPEN',
    })) as { items: CaseView[] };
    expect(filtered.items.map((item) => item.id)).toEqual([created[0]!.caseId]);
    await expect(
      safety.listCases(actor(admin.id), { limit: 20, cursor: 'broken' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    const secondQueue = (await safety.listCases(actor(second.id), { limit: 20 })) as {
      items: CaseView[];
    };
    expect((await safety.caseSummary(actor(second.id))).open).toBe(secondQueue.items.length);
    expect(secondQueue.items.every((item) => item.assigneeUserId === second.id)).toBe(true);
    const otherCase = created
      .map((item) => item.caseId)
      .find((id) => !secondQueue.items.some((item) => item.id === id));
    if (otherCase) {
      await expect(safety.evidence(actor(second.id), otherCase)).rejects.toMatchObject({
        code: 'SAFETY_ACCESS_DENIED',
      });
    }

    const evidenceCase = created[0]!;
    await prisma.roomEvent.createMany({
      data: Array.from({ length: 101 }, (_, index) => ({
        id: randomUUID(),
        roomId: evidenceCase.roomId,
        type: 'fixture_signal',
        source: 'test',
        result: 'OBSERVED',
        occurredAt: new Date(Date.now() + index),
      })),
    });
    const evidence = (await safety.evidence(actor(admin.id), evidenceCase.caseId)) as {
      report: Record<string, unknown>;
      roomEvents: { items: Array<Record<string, unknown>>; truncated: boolean };
      relatedReports: { items: unknown[]; truncated: boolean };
      restrictions: { items: unknown[]; truncated: boolean };
      speechSignals: { availability: string; riskEvents: { items: unknown[] } };
    };
    expect(evidence.roomEvents.items).toHaveLength(100);
    expect(evidence.roomEvents.truncated).toBe(true);
    expect(evidence.relatedReports).toEqual({ items: [], truncated: false });
    expect(evidence.restrictions).toEqual({ items: [], truncated: false });
    expect(evidence.speechSignals).toMatchObject({
      availability: 'NOT_ENABLED',
      riskEvents: { items: [] },
    });
    expect(Object.keys(evidence.report).sort()).toEqual([
      'category',
      'description',
      'id',
      'reporterUserId',
      'roomId',
      'submittedAt',
      'targetUserId',
    ]);
    expect(JSON.stringify(evidence)).not.toMatch(/token|providerSubject|oAuth|transcript/i);
  });

  it('distinguishes available and degraded room speech signals without returning content', async () => {
    const admin = await seedAdult(prisma, 'Speech evidence admin');
    const target = await seedAdult(prisma, 'Speech evidence target');
    const reporter = await seedAdult(prisma, 'Speech evidence reporter');
    await backoffice.bootstrap(admin.id);
    const roomId = randomUUID();
    const now = new Date();
    await prisma.room.create({
      data: {
        id: roomId,
        hostUserId: target.id,
        topic: 'Enabled speech evidence',
        cefrLevel: 'B1',
        capacity: 3,
        startedAt: now,
        endsAt: new Date(now.getTime() + 60 * 60 * 1000),
        sensitiveSpeechDetectionEnabled: true,
        memberships: {
          create: [
            {
              id: randomUUID(),
              userId: target.id,
              role: 'HOST',
              joinOrder: 1,
              rulesVersion: '2026-09-v1',
              rulesAcceptedAt: now,
              joinedAt: now,
            },
            {
              id: randomUUID(),
              userId: reporter.id,
              role: 'MEMBER',
              joinOrder: 2,
              rulesVersion: '2026-09-v1',
              rulesAcceptedAt: now,
              joinedAt: now,
            },
          ],
        },
      },
    });
    const receipt = await reports.submit({
      roomId,
      reporterUserId: reporter.id,
      targetUserId: target.id,
      clientRequestId: randomUUID(),
      category: 'HARASSMENT_ABUSE',
      description: 'Speech evidence fixture',
    });
    await expect(safety.evidence(actor(admin.id), receipt.caseId)).resolves.toMatchObject({
      speechSignals: {
        availability: 'AVAILABLE',
        riskEvents: { items: [] },
        capabilityIncidents: { items: [] },
      },
    });
    await prisma.roomSpeechRiskEvent.create({
      data: {
        id: randomUUID(),
        roomId,
        subjectUserId: target.id,
        category: 'HARASSMENT_ABUSE',
        severity: 'MEDIUM',
        ruleSetVersion: 'rules-v1',
        correlationHash: 'e'.repeat(64),
        firstOccurredAt: now,
        lastOccurredAt: now,
      },
    });
    await prisma.safetyCapabilityIncident.create({
      data: {
        id: randomUUID(),
        roomId,
        component: 'STREAMING_STT',
        errorCategory: 'PROVIDER_UNAVAILABLE',
        activeKey: `${roomId}:STREAMING_STT:PROVIDER_UNAVAILABLE`,
        startedAt: now,
        lastObservedAt: now,
      },
    });
    const degraded = await safety.evidence(actor(admin.id), receipt.caseId);
    expect(degraded).toMatchObject({
      speechSignals: {
        availability: 'DEGRADED',
        riskEvents: { items: [{ category: 'HARASSMENT_ABUSE', severity: 'MEDIUM' }] },
        capabilityIncidents: {
          items: [{ component: 'STREAMING_STT', errorCategory: 'PROVIDER_UNAVAILABLE' }],
        },
      },
    });
    expect(JSON.stringify(degraded)).not.toMatch(/audio|transcript|matchedText|providerResponse/);
  });

  it('commits dismiss and no-action terminal decisions without creating restrictions', async () => {
    const officer = await seedAdult(prisma);
    await backoffice.bootstrap(officer.id);
    const dismissedCase = await createReportCase();
    const noActionCase = await createReportCase();
    for (const item of [dismissedCase, noActionCase])
      await safety.start(actor(officer.id), item.caseId, randomUUID());

    const dismissKey = randomUUID();
    const dismissed = (await safety.dismiss(
      actor(officer.id),
      dismissedCase.caseId,
      dismissKey,
      '  insufficient evidence ',
    )) as CaseView;
    expect(dismissed.status).toBe('DISMISSED');
    expect(
      await safety.dismiss(
        actor(officer.id),
        dismissedCase.caseId,
        dismissKey,
        'insufficient evidence',
      ),
    ).toEqual(dismissed);
    const noAction = (await safety.resolve({
      actor: actor(officer.id),
      caseId: noActionCase.caseId,
      clientRequestId: randomUUID(),
      resolution: 'NO_ACTION',
      reason: 'review completed',
    })) as ResolveView;
    expect(noAction).toMatchObject({ case: { status: 'RESOLVED' }, restriction: null });
    expect(
      await prisma.safetyRestriction.count({
        where: { caseId: { in: [dismissedCase.caseId, noActionCase.caseId] } },
      }),
    ).toBe(0);
    await expect(
      safety.dismiss(
        actor(officer.id),
        noActionCase.caseId,
        randomUUID(),
        'second terminal decision',
      ),
    ).rejects.toMatchObject({ code: 'SAFETY_STATE_CONFLICT' });
  });

  it('validates permanent disables, protects the last admin and revokes active sessions', async () => {
    const targetAdmin = await seedAdult(prisma, 'Target admin');
    const officer = await seedAdult(prisma, 'Safety officer');
    await backoffice.bootstrap(targetAdmin.id);
    await grantSafety(targetAdmin.id, officer.id);
    await backoffice.mutateRole({
      actorUserId: targetAdmin.id,
      targetUserId: targetAdmin.id,
      role: 'SAFETY_OFFICER',
      action: 'REVOKE',
      reason: 'separate permanent disable review',
      clientRequestId: randomUUID(),
    });
    const pending = await createReportCase(targetAdmin.id);
    await prisma.safetyCase.update({
      where: { id: pending.caseId },
      data: { assigneeUserId: officer.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });
    await sessions.issue(targetAdmin.id);

    await expect(
      safety.resolve({
        actor: actor(officer.id),
        caseId: pending.caseId,
        clientRequestId: randomUUID(),
        resolution: 'PERMANENT_DISABLE',
        severity: 'GENERAL',
        factsConfirmed: true,
        reason: 'general is insufficient',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      safety.resolve({
        actor: actor(officer.id),
        caseId: pending.caseId,
        clientRequestId: randomUUID(),
        resolution: 'PERMANENT_DISABLE',
        severity: 'SERIOUS',
        factsConfirmed: false,
        reason: 'facts are not confirmed',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const rejectedKey = randomUUID();
    const permanent = {
      actor: actor(officer.id),
      caseId: pending.caseId,
      clientRequestId: rejectedKey,
      resolution: 'PERMANENT_DISABLE' as const,
      severity: 'SERIOUS' as const,
      factsConfirmed: true,
      reason: 'confirmed serious behavior',
    };
    await expect(safety.resolve(permanent)).rejects.toMatchObject({
      code: 'LAST_PLATFORM_ADMIN_REQUIRED',
    });
    await expect(safety.resolve(permanent)).rejects.toMatchObject({
      code: 'LAST_PLATFORM_ADMIN_REQUIRED',
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: targetAdmin.id } })).status).toBe(
      'ACTIVE',
    );
    expect(await prisma.safetyRestriction.count({ where: { caseId: pending.caseId } })).toBe(0);
    expect(
      await prisma.backofficeAuditEvent.count({
        where: { clientRequestId: rejectedKey, result: 'REJECTED' },
      }),
    ).toBe(1);

    const successor = await seedAdult(prisma, 'Successor admin');
    await backoffice.mutateRole({
      actorUserId: targetAdmin.id,
      targetUserId: successor.id,
      role: 'PLATFORM_ADMIN',
      action: 'GRANT',
      reason: 'preserve administration',
      clientRequestId: randomUUID(),
    });
    const result = (await safety.resolve({
      ...permanent,
      clientRequestId: randomUUID(),
    })) as ResolveView;
    expect(result.restriction).toMatchObject({ status: 'ACTIVE', severity: 'SERIOUS' });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: targetAdmin.id } })).status).toBe(
      'DISABLED',
    );
    expect(
      await prisma.authSession.count({
        where: { userId: targetAdmin.id, revokedAt: { not: null } },
      }),
    ).toBe(1);
    await expect(
      safety.appeal(targetAdmin.id, result.restriction!.id, {
        clientRequestId: randomUUID(),
        reason: 'permanent actions are not appealable here',
      }),
    ).rejects.toMatchObject({ code: 'SAFETY_APPEAL_CLOSED' });
    expect(
      await prisma.backofficeRoleAssignment.count({
        where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
      }),
    ).toBe(1);
  });

  it('shares the platform-admin lock across role revocation and permanent disable', async () => {
    const firstAdmin = await seedAdult(prisma, 'First concurrent admin');
    const secondAdmin = await seedAdult(prisma, 'Second concurrent admin');
    const officer = await seedAdult(prisma, 'Concurrent safety officer');
    await backoffice.bootstrap(firstAdmin.id);
    await backoffice.mutateRole({
      actorUserId: firstAdmin.id,
      targetUserId: secondAdmin.id,
      role: 'PLATFORM_ADMIN',
      action: 'GRANT',
      reason: 'concurrency fixture',
      clientRequestId: randomUUID(),
    });
    await grantSafety(firstAdmin.id, officer.id);
    const pending = await createReportCase(firstAdmin.id);
    await prisma.safetyCase.update({
      where: { id: pending.caseId },
      data: { assigneeUserId: officer.id, assignedAt: new Date(), status: 'UNDER_REVIEW' },
    });

    const results = await Promise.allSettled([
      backoffice.mutateRole({
        actorUserId: secondAdmin.id,
        targetUserId: secondAdmin.id,
        role: 'PLATFORM_ADMIN',
        action: 'REVOKE',
        reason: 'concurrent removal',
        clientRequestId: randomUUID(),
      }),
      safety.resolve({
        actor: actor(officer.id),
        caseId: pending.caseId,
        clientRequestId: randomUUID(),
        resolution: 'PERMANENT_DISABLE',
        severity: 'HIGH_RISK',
        factsConfirmed: true,
        reason: 'concurrent permanent action',
      }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toMatchObject([
      { reason: { code: 'LAST_PLATFORM_ADMIN_REQUIRED' } },
    ]);
    expect(
      await prisma.backofficeRoleAssignment.count({
        where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
      }),
    ).toBe(1);
  });

  it('does not return sensitive evidence when its success audit cannot be committed', async () => {
    const officer = await seedAdult(prisma);
    await backoffice.bootstrap(officer.id);
    const pending = await createReportCase();
    const evidence = (await safety.evidence(actor(officer.id), pending.caseId)) as object;
    expect(JSON.stringify(evidence)).toContain('private safety report text');
    expect(JSON.stringify(evidence)).not.toMatch(/participantToken|providerSubject|refreshToken/i);
    await safety.start(actor(officer.id), pending.caseId, randomUUID());
    const resolved = (await safety.resolve({
      actor: actor(officer.id),
      caseId: pending.caseId,
      clientRequestId: randomUUID(),
      resolution: 'TEMPORARY_RESTRICTION',
      severity: 'GENERAL',
      reason: 'audit transaction fixture',
    })) as ResolveView;
    await safety.appeal(pending.targetUserId, resolved.restriction!.id, {
      clientRequestId: randomUUID(),
      reason: 'audit failure appeal body',
    });
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION safety_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private safety report text SELECT secret'; END; $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER safety_audit_failure BEFORE INSERT ON "BackofficeAuditEvent" FOR EACH ROW EXECUTE FUNCTION safety_audit_fail()`,
    );
    try {
      for (const read of [
        () => safety.listCases(actor(officer.id), { limit: 20 }),
        () => safety.detail(actor(officer.id), pending.caseId),
        () => safety.evidence(actor(officer.id), pending.caseId),
        () => safety.listRestrictions(actor(officer.id), { limit: 20 }),
        () => safety.listAppeals(actor(officer.id), { limit: 20 }),
      ])
        await expect(read()).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER safety_audit_failure ON "BackofficeAuditEvent"');
      await prisma.$executeRawUnsafe('DROP FUNCTION safety_audit_fail()');
    }
  });
});
