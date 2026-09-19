import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  ACCOUNT_LIFECYCLE_REPOSITORY,
  AccountLifecycleError,
  type AccountLifecycleRepository,
} from '../../src/modules/account-lifecycle/index.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('account lifecycle repository', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: AccountLifecycleRepository;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(ACCOUNT_LIFECYCLE_REPOSITORY);
  });

  beforeEach(async () => clearRealtimeFixtures(prisma));
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await moduleRef.close();
  });

  it('atomically disables access, transfers an open room and converges future/social access', async () => {
    const owner = await seedAdult(prisma, 'Owner');
    const successor = await seedAdult(prisma, 'Successor');
    const now = new Date('2026-09-17T12:00:00.000Z');
    const roomId = randomUUID();
    const ownerMembership = randomUUID();
    const successorMembership = randomUUID();
    const identity = randomUUID();
    await prisma.room.create({
      data: {
        id: roomId,
        hostUserId: owner.id,
        topic: 'Account lifecycle room',
        cefrLevel: 'B1',
        capacity: 4,
        status: 'OPEN',
        startedAt: new Date(now.getTime() - 60_000),
        endsAt: new Date(now.getTime() + 3_600_000),
        initialHostResolved: true,
      },
    });
    await prisma.roomMembership.createMany({
      data: [
        {
          id: ownerMembership,
          roomId,
          userId: owner.id,
          role: 'HOST',
          joinOrder: 1,
          rulesVersion: 'v1',
          rulesAcceptedAt: now,
          joinedAt: now,
          participantIdentity: identity,
          presence: 'CONNECTED',
        },
        {
          id: successorMembership,
          roomId,
          userId: successor.id,
          role: 'MEMBER',
          joinOrder: 2,
          rulesVersion: 'v1',
          rulesAcceptedAt: now,
          joinedAt: now,
          participantIdentity: randomUUID(),
          presence: 'CONNECTED',
        },
      ],
    });
    await prisma.realtimeIdentity.create({
      data: {
        identity,
        roomId,
        membershipId: ownerMembership,
        credentialVersion: 0,
        issueUntil: new Date(now.getTime() + 300_000),
      },
    });
    await prisma.realtimeIssuance.create({
      data: { id: randomUUID(), identity, expiresAt: new Date(now.getTime() + 300_000) },
    });
    await prisma.phoneIdentity.create({
      data: {
        id: randomUUID(),
        userId: owner.id,
        phoneLookupVersion: 'v1',
        phoneLookupHash: '7'.repeat(64),
        countryCallingCode: '86',
        lastTwo: '00',
        verifiedAt: now,
      },
    });
    await prisma.oAuthIdentity.create({
      data: {
        id: randomUUID(),
        userId: owner.id,
        provider: 'GOOGLE',
        issuer: 'https://accounts.google.com',
        subject: 'retained-owner',
      },
    });
    await prisma.roomNote.create({
      data: { roomId, userId: owner.id, content: 'retained private note' },
    });
    const report = await prisma.report.create({
      data: {
        roomId,
        reporterUserId: successor.id,
        targetUserId: owner.id,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'retained evidence',
      },
    });
    await prisma.safetyCase.create({
      data: { reportId: report.id, roomId, targetUserId: owner.id },
    });
    await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: owner.id,
        expiresAt: new Date(now.getTime() + 86_400_000),
        lastRotatedAt: now,
      },
    });
    const scheduled = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: owner.id,
        kind: 'APPOINTMENT',
        topic: 'Future room',
        cefrLevel: 'B1',
        capacity: 4,
        status: 'SCHEDULED',
        startedAt: new Date(now.getTime() + 86_400_000),
        initialHostDeadline: new Date(now.getTime() + 86_700_000),
        endsAt: new Date(now.getTime() + 90_000_000),
      },
    });
    await prisma.roomReservation.create({
      data: { roomId: scheduled.id, userId: successor.id },
    });
    await prisma.friendRequest.create({
      data: {
        id: randomUUID(),
        requesterUserId: owner.id,
        recipientUserId: successor.id,
        userLowId: owner.id < successor.id ? owner.id : successor.id,
        userHighId: owner.id < successor.id ? successor.id : owner.id,
      },
    });
    await prisma.friendship.create({
      data: {
        id: randomUUID(),
        userLowId: owner.id < successor.id ? owner.id : successor.id,
        userHighId: owner.id < successor.id ? successor.id : owner.id,
      },
    });
    await prisma.roomInvitation.create({
      data: {
        id: randomUUID(),
        roomId,
        inviterUserId: successor.id,
        inviteeUserId: owner.id,
      },
    });

    const clientRequestId = randomUUID();
    const result = await repository.deleteAccount({
      userId: owner.id,
      clientRequestId,
      payloadHash: 'f'.repeat(64),
      now,
    });
    expect(result).toEqual({ userId: owner.id, status: 'DELETED', deletedAt: now });
    await expect(
      repository.deleteAccount({
        userId: owner.id,
        clientRequestId,
        payloadHash: 'f'.repeat(64),
        now: new Date(now.getTime() + 1000),
      }),
    ).resolves.toEqual(result);
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toMatchObject({
      status: 'DELETED',
      deletedAt: now,
    });
    expect(await prisma.room.findUnique({ where: { id: roomId } })).toMatchObject({
      hostUserId: successor.id,
      status: 'OPEN',
    });
    expect(await prisma.room.findUnique({ where: { id: scheduled.id } })).toMatchObject({
      status: 'CANCELLED',
    });
    expect(
      await prisma.roomMembership.findUnique({ where: { id: ownerMembership } }),
    ).toMatchObject({
      lifecycle: 'LEFT',
      presence: 'DISCONNECTED',
      credentialVersion: 1,
    });
    expect(await prisma.realtimeIdentity.findUnique({ where: { identity } })).toMatchObject({
      revokedAt: now,
    });
    expect(await prisma.realtimeCommand.count({ where: { identity } })).toBe(1);
    expect(await prisma.authSession.count({ where: { userId: owner.id, revokedAt: null } })).toBe(
      0,
    );
    expect(await prisma.roomInvitation.count({ where: { status: 'PENDING' } })).toBe(0);
    expect(await prisma.friendRequest.count({ where: { status: 'PENDING' } })).toBe(0);
    expect(await prisma.friendship.count({ where: { endedAt: null } })).toBe(0);
    expect(await prisma.phoneIdentity.count({ where: { userId: owner.id } })).toBe(1);
    expect(await prisma.oAuthIdentity.count({ where: { userId: owner.id } })).toBe(1);
    expect(await prisma.roomNote.count({ where: { userId: owner.id } })).toBe(1);
    expect(await prisma.safetyCase.count({ where: { targetUserId: owner.id } })).toBe(1);
  });

  it('blocks role holders and audits authorized and denied restricted reads', async () => {
    const target = await seedAdult(prisma, 'Deleted target');
    const admin = await seedAdult(prisma, 'Admin');
    const ordinary = await seedAdult(prisma, 'Ordinary');
    await prisma.backofficeRoleAssignment.create({
      data: { userId: target.id, role: 'AUDITOR' },
    });
    await expect(
      repository.deleteAccount({
        userId: target.id,
        clientRequestId: randomUUID(),
        payloadHash: 'a'.repeat(64),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_DELETE_ROLE_ACTIVE' });
    await prisma.backofficeRoleAssignment.update({
      where: { userId_role: { userId: target.id, role: 'AUDITOR' } },
      data: { revokedAt: new Date(), revokedByUserId: admin.id, version: { increment: 1 } },
    });
    await repository.deleteAccount({
      userId: target.id,
      clientRequestId: randomUUID(),
      payloadHash: 'b'.repeat(64),
      now: new Date(),
    });
    await prisma.backofficeRoleAssignment.create({
      data: { userId: admin.id, role: 'PLATFORM_ADMIN' },
    });
    const record = await repository.restrictedRecord({
      actorUserId: admin.id,
      targetUserId: target.id,
      requestId: 'authorized-read',
      now: new Date(),
    });
    expect(record).toMatchObject({ userId: target.id, status: 'DELETED' });
    expect(record).not.toHaveProperty('phoneLookupHash');
    await expect(
      repository.restrictedRecord({
        actorUserId: ordinary.id,
        targetUserId: target.id,
        requestId: 'denied-read',
        now: new Date(),
      }),
    ).rejects.toBeInstanceOf(AccountLifecycleError);
    expect(
      await prisma.backofficeAuditEvent.count({
        where: {
          action: {
            in: ['ACCOUNT_RESTRICTED_RECORD_VIEWED', 'ACCOUNT_RESTRICTED_RECORD_REJECTED'],
          },
        },
      }),
    ).toBe(2);
    await repository.purgeCommands(new Date(Date.now() + 31 * 86_400_000));
    expect(await prisma.accountLifecycleCommand.count({ where: { userId: target.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: target.id, status: 'DELETED' } })).toBe(1);
    expect(
      await prisma.backofficeAuditEvent.count({ where: { targetId: target.id } }),
    ).toBeGreaterThan(0);
  });

  it('rolls back every lifecycle mutation when a late durable write fails', async () => {
    const user = await seedAdult(prisma, 'Rollback target');
    const clientRequestId = randomUUID();
    await prisma.authSession.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.backofficeAuditEvent.create({
      data: {
        actorType: 'USER',
        actorUserId: user.id,
        actorRoles: [],
        action: 'TEST_CONFLICT',
        targetType: 'USER',
        targetId: user.id,
        result: 'SUCCEEDED',
        clientRequestId,
        requestHash: 'd'.repeat(64),
      },
    });
    await expect(
      repository.deleteAccount({
        userId: user.id,
        clientRequestId,
        payloadHash: 'c'.repeat(64),
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({
      status: 'ACTIVE',
      deletedAt: null,
    });
    expect(await prisma.authSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(1);
    expect(await prisma.accountLifecycleCommand.count({ where: { userId: user.id } })).toBe(0);
  });
});
