import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { RoomInvitationsService, RoomsService } from '../../src/modules/rooms/index.js';
import { SocialService } from '../../src/modules/social/index.js';
import {
  SOCIAL_PRESENCE,
  type SocialPresence,
} from '../../src/modules/social/domain/ports/presence.port.js';

class FakePresence implements SocialPresence {
  readonly users = new Set<string>();
  async refresh(userId: string) {
    this.users.add(userId);
    return { expiresAt: new Date(Date.now() + 90_000), refreshAfterSeconds: 45 };
  }
  async online(userIds: string[]) {
    return new Set(userIds.filter((userId) => this.users.has(userId)));
  }
  async clear(userId: string) {
    this.users.delete(userId);
  }
}

describe('friends, blocking, availability and room invitations', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let social: SocialService;
  let rooms: RoomsService;
  let invitations: RoomInvitationsService;
  const presence = new FakePresence();
  const users = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const [alice, bob, charlie, outsider] = users as [string, string, string, string];
  const now = new Date('2026-09-15T12:00:00.000Z');

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SOCIAL_PRESENCE)
      .useValue(presence)
      .compile();
    prisma = moduleRef.get(PrismaService);
    social = moduleRef.get(SocialService);
    rooms = moduleRef.get(RoomsService);
    invitations = moduleRef.get(RoomInvitationsService);
    for (const [index, id] of users.entries()) {
      await prisma.user.create({
        data: {
          id,
          profile: {
            create: {
              avatarUrl: `https://example.com/social-${index}.png`,
              displayName: `Social user ${index}`,
              genderCode: 'prefer_not_to_say',
              nationalityCode: 'CN',
              city: 'Shanghai',
              interestCodes: ['conversation'],
              cefrLevel: 'B1',
              birthYear: 1990,
              birthMonth: 1,
              completedAt: now,
            },
          },
        },
      });
    }
  });

  beforeEach(async () => {
    presence.users.clear();
    await prisma.roomInvitation.deleteMany({
      where: { OR: [{ inviterUserId: { in: users } }, { inviteeUserId: { in: users } }] },
    });
    await prisma.friendRequest.deleteMany({
      where: { OR: [{ requesterUserId: { in: users } }, { recipientUserId: { in: users } }] },
    });
    await prisma.friendship.deleteMany({
      where: { OR: [{ userLowId: { in: users } }, { userHighId: { in: users } }] },
    });
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerUserId: { in: users } }, { blockedUserId: { in: users } }] },
    });
    await prisma.socialCommand.deleteMany({ where: { actorUserId: { in: users } } });
    await prisma.room.deleteMany({ where: { hostUserId: { in: users } } });
  });

  afterAll(async () => {
    await prisma.roomInvitation.deleteMany({
      where: { OR: [{ inviterUserId: { in: users } }, { inviteeUserId: { in: users } }] },
    });
    await prisma.friendRequest.deleteMany({
      where: { OR: [{ requesterUserId: { in: users } }, { recipientUserId: { in: users } }] },
    });
    await prisma.friendship.deleteMany({
      where: { OR: [{ userLowId: { in: users } }, { userHighId: { in: users } }] },
    });
    await prisma.userBlock.deleteMany({
      where: { OR: [{ blockerUserId: { in: users } }, { blockedUserId: { in: users } }] },
    });
    await prisma.socialCommand.deleteMany({ where: { actorUserId: { in: users } } });
    await prisma.room.deleteMany({ where: { hostUserId: { in: users } } });
    await prisma.userProfile.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await moduleRef.close();
  });

  async function becomeFriends(left = alice, right = bob) {
    const request = await social.createFriendRequest(
      left,
      { targetUserId: right, clientRequestId: randomUUID() },
      now,
    );
    await social.resolveFriendRequest(right, request.id, 'accept', randomUUID(), now);
    return request;
  }

  it('requires consent and safely replays or rejects friend commands', async () => {
    const clientRequestId = randomUUID();
    const request = await social.createFriendRequest(
      alice,
      { targetUserId: bob, clientRequestId },
      now,
    );
    expect(
      (await social.createFriendRequest(alice, { targetUserId: bob, clientRequestId }, now)).id,
    ).toBe(request.id);
    expect(
      (
        await social.createFriendRequest(
          bob,
          { targetUserId: alice, clientRequestId: randomUUID() },
          now,
        )
      ).id,
    ).toBe(request.id);

    const acceptId = randomUUID();
    const accepted = await social.resolveFriendRequest(bob, request.id, 'accept', acceptId, now);
    expect(accepted.status).toBe('ACCEPTED');
    expect(
      (await social.resolveFriendRequest(bob, request.id, 'accept', acceptId, now)).status,
    ).toBe('ACCEPTED');
    await expect(
      social.resolveFriendRequest(bob, request.id, 'reject', acceptId, now),
    ).rejects.toMatchObject({ code: 'SOCIAL_REQUEST_CONFLICT' });
    await expect(
      social.resolveFriendRequest(alice, request.id, 'reject', randomUUID(), now),
    ).rejects.toMatchObject({ code: 'SOCIAL_REQUEST_NOT_FOUND' });
    expect((await social.listFriends(alice, {}, now)).items[0]?.friend.userId).toBe(bob);
  });

  it('blocks both social directions and does not restore friendship on unblock', async () => {
    await becomeFriends();
    const block = await social.createBlock(
      alice,
      { targetUserId: bob, clientRequestId: randomUUID() },
      now,
    );
    expect(block.blockedUserId).toBe(bob);
    expect((await social.listFriends(alice, {}, now)).items).toEqual([]);
    expect((await social.listFriends(bob, {}, now)).items).toEqual([]);
    expect((await social.listBlocks(alice, {}, now)).items).toHaveLength(1);
    await expect(
      social.createFriendRequest(bob, { targetUserId: alice, clientRequestId: randomUUID() }, now),
    ).rejects.toMatchObject({ code: 'SOCIAL_TARGET_UNAVAILABLE' });
    await social.deleteBlock(alice, bob, randomUUID(), now);
    expect((await social.listFriends(alice, {}, now)).items).toEqual([]);
    expect(
      (
        await social.createFriendRequest(
          bob,
          { targetUserId: alice, clientRequestId: randomUUID() },
          now,
        )
      ).status,
    ).toBe('PENDING');
  });

  it('atomically rolls back friendship and invitation cleanup when command audit fails', async () => {
    await becomeFriends();
    const room = await rooms.create(
      alice,
      { topic: 'Rollback room', cefrLevel: 'B1', capacity: 3 },
      now,
    );
    const invitation = await invitations.create(
      alice,
      room.room.id,
      { targetUserId: bob, clientRequestId: randomUUID() },
      now,
    );
    const functionName = `fail_social_${randomUUID().replaceAll('-', '')}`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."actorUserId"='${alice}'::uuid THEN RAISE EXCEPTION 'forced command failure'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${functionName}" BEFORE INSERT ON "SocialCommand" FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
    );
    try {
      await expect(
        social.createBlock(alice, { targetUserId: bob, clientRequestId: randomUUID() }, now),
      ).rejects.toThrow('forced command failure');
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER "${functionName}" ON "SocialCommand"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION "${functionName}"()`);
    }
    expect(await prisma.friendship.count({ where: { endedAt: null } })).toBe(1);
    expect(
      (await prisma.roomInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status,
    ).toBe('PENDING');
    expect(await prisma.userBlock.count({ where: { unblockedAt: null } })).toBe(0);
  });

  it('filters underage, disabled and safety-restricted targets', async () => {
    presence.users.add(bob);
    presence.users.add(charlie);
    await prisma.userProfile.update({ where: { userId: bob }, data: { birthYear: 2010 } });
    await prisma.user.update({ where: { id: charlie }, data: { status: 'DISABLED' } });
    const available = await social.listAvailable(alice, {}, now);
    expect(available.items.map((item) => item.userId)).not.toEqual(
      expect.arrayContaining([bob, charlie]),
    );
    await expect(
      social.createFriendRequest(alice, { targetUserId: bob, clientRequestId: randomUUID() }, now),
    ).rejects.toMatchObject({ code: 'SOCIAL_TARGET_UNAVAILABLE' });
    await prisma.userProfile.update({ where: { userId: bob }, data: { birthYear: 1990 } });
    await prisma.user.update({ where: { id: charlie }, data: { status: 'ACTIVE' } });

    const room = await rooms.create(
      alice,
      { topic: 'Restriction source', cefrLevel: 'B1', capacity: 3 },
      now,
    );
    await rooms.join(charlie, room.room.id, { rulesAccepted: true }, now);
    const reportId = randomUUID();
    const caseId = randomUUID();
    await prisma.report.create({
      data: {
        id: reportId,
        roomId: room.room.id,
        reporterUserId: alice,
        targetUserId: charlie,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'eligibility fixture',
        submittedAt: now,
      },
    });
    await prisma.safetyCase.create({
      data: {
        id: caseId,
        reportId,
        roomId: room.room.id,
        targetUserId: charlie,
        status: 'RESOLVED',
        assessedSeverity: 'GENERAL',
        decisionType: 'TEMPORARY_RESTRICTION',
        decisionReason: 'eligibility fixture',
        decidedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.safetyRestriction.create({
      data: {
        id: randomUUID(),
        caseId,
        userId: charlie,
        kind: 'TEMPORARY',
        severity: 'GENERAL',
        reason: 'eligibility fixture',
        decidedByUserId: alice,
        startsAt: new Date(now.getTime() - 1000),
        endsAt: new Date(now.getTime() + 60_000),
        appealDeadlineAt: new Date(now.getTime() + 30_000),
        createdAt: now,
        updatedAt: now,
      },
    });
    await expect(
      social.createFriendRequest(
        bob,
        { targetUserId: charlie, clientRequestId: randomUUID() },
        now,
      ),
    ).rejects.toMatchObject({ code: 'SOCIAL_TARGET_UNAVAILABLE' });
    await prisma.safetyRestriction.deleteMany({ where: { caseId } });
    await prisma.safetyCase.delete({ where: { id: caseId } });
    await prisma.report.delete({ where: { id: reportId } });
  });

  it('projects availability from presence and persistent room membership', async () => {
    presence.users.add(bob);
    expect((await social.listAvailable(alice, {}, now)).items.map((item) => item.userId)).toContain(
      bob,
    );
    await rooms.create(bob, { topic: 'Busy room', cefrLevel: 'B1', capacity: 2 }, now);
    expect(
      (await social.listAvailable(alice, {}, now)).items.map((item) => item.userId),
    ).not.toContain(bob);
  });

  it('creates, lists and atomically consumes a password-protected invitation', async () => {
    await becomeFriends();
    const room = await rooms.create(
      alice,
      { topic: 'Invited room', cefrLevel: 'B1', capacity: 2, password: '1234' },
      now,
    );
    const invitation = await invitations.create(
      alice,
      room.room.id,
      { targetUserId: bob, clientRequestId: randomUUID() },
      now,
    );
    expect((await invitations.list(bob, {}, now)).items[0]?.id).toBe(invitation.id);
    await expect(
      rooms.join(
        bob,
        room.room.id,
        { rulesAccepted: true, password: '0000', invitationId: invitation.id },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ROOM_PASSWORD_INVALID' });
    expect(
      (await prisma.roomInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status,
    ).toBe('PENDING');
    await rooms.join(
      bob,
      room.room.id,
      { rulesAccepted: true, password: '1234', invitationId: invitation.id },
      now,
    );
    expect(
      (await prisma.roomInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status,
    ).toBe('CONSUMED');
  });

  it('replays invitation commands, cancels on block and keeps removed members on the host-control path', async () => {
    await becomeFriends();
    const room = await rooms.create(
      alice,
      { topic: 'Invitation lifecycle', cefrLevel: 'B1', capacity: 3 },
      now,
    );
    const createId = randomUUID();
    const invitation = await invitations.create(
      alice,
      room.room.id,
      { targetUserId: bob, clientRequestId: createId },
      now,
    );
    expect(
      (
        await invitations.create(
          alice,
          room.room.id,
          { targetUserId: bob, clientRequestId: createId },
          now,
        )
      ).id,
    ).toBe(invitation.id);
    await social.createBlock(alice, { targetUserId: bob, clientRequestId: randomUUID() }, now);
    expect(
      (await prisma.roomInvitation.findUniqueOrThrow({ where: { id: invitation.id } })).status,
    ).toBe('CANCELLED');

    await social.deleteBlock(alice, bob, randomUUID(), now);
    await becomeFriends();
    await rooms.join(bob, room.room.id, { rulesAccepted: true }, now);
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId: room.room.id, userId: bob } },
      data: { lifecycle: 'REMOVED', removedAt: now },
    });
    presence.users.add(bob);
    await expect(
      invitations.create(
        alice,
        room.room.id,
        { targetUserId: bob, clientRequestId: randomUUID() },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ROOM_INVITATION_REQUIRED' });
  });

  it('declines idempotently and rejects request-id reuse with different content', async () => {
    await becomeFriends();
    const room = await rooms.create(
      alice,
      { topic: 'Decline room', cefrLevel: 'B1', capacity: 3 },
      now,
    );
    const invitation = await invitations.create(
      alice,
      room.room.id,
      { targetUserId: bob, clientRequestId: randomUUID() },
      now,
    );
    const declineId = randomUUID();
    expect((await invitations.decline(bob, invitation.id, declineId, now)).status).toBe('DECLINED');
    expect((await invitations.decline(bob, invitation.id, declineId, now)).status).toBe('DECLINED');
    await expect(social.deleteFriend(bob, alice, declineId, now)).rejects.toMatchObject({
      code: 'SOCIAL_REQUEST_CONFLICT',
    });
  });

  it('keeps capacity under concurrent invited joins and rejects non-hosts', async () => {
    presence.users.add(bob);
    presence.users.add(charlie);
    const room = await rooms.create(
      alice,
      { topic: 'Capacity room', cefrLevel: 'B2', capacity: 2 },
      now,
    );
    await expect(
      invitations.create(
        outsider,
        room.room.id,
        { targetUserId: bob, clientRequestId: randomUUID() },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ROOM_HOST_REQUIRED' });
    const [bobInvitation, charlieInvitation] = await Promise.all([
      invitations.create(
        alice,
        room.room.id,
        { targetUserId: bob, clientRequestId: randomUUID() },
        now,
      ),
      invitations.create(
        alice,
        room.room.id,
        { targetUserId: charlie, clientRequestId: randomUUID() },
        now,
      ),
    ]);
    const results = await Promise.allSettled([
      rooms.join(bob, room.room.id, { rulesAccepted: true, invitationId: bobInvitation.id }, now),
      rooms.join(
        charlie,
        room.room.id,
        { rulesAccepted: true, invitationId: charlieInvitation.id },
        now,
      ),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.roomMembership.count({ where: { roomId: room.room.id, lifecycle: 'ACTIVE' } }),
    ).toBe(2);
  });
});
