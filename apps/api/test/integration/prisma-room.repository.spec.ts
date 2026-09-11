import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  ROOM_REPOSITORY,
  type RoomRepository,
  RoomsService,
} from '../../src/modules/rooms/index.js';

describe('Prisma instant room repository', () => {
  const now = new Date('2026-09-11T10:00:00.000Z');
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: RoomRepository;
  let service: RoomsService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get<RoomRepository>(ROOM_REPOSITORY);
    service = moduleRef.get(RoomsService);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.roomMembership.deleteMany();
    await prisma.room.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.authSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.oAuthIdentity.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => moduleRef.close());

  async function eligibleUser(displayName: string): Promise<string> {
    const userId = randomUUID();
    await prisma.user.create({
      data: {
        id: userId,
        createdAt: now,
        updatedAt: now,
        profile: {
          create: {
            avatarUrl: 'https://example.com/avatar.png',
            displayName,
            genderCode: 'prefer_not_to_say',
            nationalityCode: 'CN',
            interestCodes: ['backend'],
            cefrLevel: 'B1',
            birthYear: 2000,
            birthMonth: 1,
            completedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    });
    return userId;
  }

  it('applies room tables, constraints, foreign keys and indexes', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const constraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
    `;
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
    `;

    expect(tables.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining(['Room', 'RoomMembership']),
    );
    expect(constraints.map(({ constraint_name }) => constraint_name)).toEqual(
      expect.arrayContaining([
        'Room_capacity_check',
        'Room_ends_after_start_check',
        'RoomMembership_roomId_fkey',
        'RoomMembership_userId_fkey',
      ]),
    );
    expect(indexes.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        'Room_status_startedAt_id_idx',
        'RoomMembership_roomId_userId_key',
        'RoomMembership_roomId_joinOrder_key',
      ]),
    );
  });

  it('creates the room and host membership atomically with profile projection', async () => {
    const hostUserId = await eligibleUser('Database Host');
    const room = await service.create(
      hostUserId,
      { topic: '  Database English  ', cefrLevel: 'B2', capacity: 6, password: '1234' },
      now,
    );

    expect(room).toMatchObject({
      room: {
        hostUserId,
        hostDisplayName: 'Database Host',
        topic: 'Database English',
        capacity: 6,
        memberCount: 1,
      },
      currentMembership: { userId: hostUserId, role: 'HOST', joinOrder: 1 },
    });
    expect(room.room.passwordDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(room.room.passwordDigest).not.toContain('1234');
    expect(await prisma.room.count()).toBe(1);
    expect(await prisma.roomMembership.count()).toBe(1);
    expect(room.room.endsAt.getTime() - room.room.startedAt.getTime()).toBe(7_200_000);

    const missingHost = randomUUID();
    await expect(
      repository.createWithHost({
        id: randomUUID(),
        hostUserId: missingHost,
        hostMembershipId: randomUUID(),
        topic: 'Must roll back',
        cefrLevel: 'B1',
        capacity: 2,
        passwordDigest: null,
        rulesVersion: '2026-09-v1',
        startedAt: now,
        endsAt: new Date(now.getTime() + 7_200_000),
      }),
    ).rejects.toBeDefined();
    expect(await prisma.room.count()).toBe(1);
    expect(await prisma.roomMembership.count()).toBe(1);
  });

  it('filters expired rooms and provides stable cursor pagination and detail membership state', async () => {
    const hostUserId = await eligibleUser('Pagination Host');
    const openOne = await service.create(
      hostUserId,
      { topic: 'Open one', cefrLevel: 'A2', capacity: 4 },
      now,
    );
    await service.create(
      hostUserId,
      { topic: 'Open two', cefrLevel: 'B1', capacity: 4 },
      new Date(now.getTime() + 1_000),
    );
    await service.create(
      hostUserId,
      { topic: 'Expired', cefrLevel: 'C1', capacity: 4 },
      new Date(now.getTime() - 10_000_000),
    );

    const firstPage = await service.list(hostUserId, { limit: 1 }, now);
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();
    const secondPage = await service.list(
      hostUserId,
      { limit: 1, cursor: firstPage.nextCursor! },
      now,
    );
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
    expect([...firstPage.items, ...secondPage.items].map(({ topic }) => topic)).not.toContain(
      'Expired',
    );

    const hostDetail = await service.detail(hostUserId, openOne.room.id, now);
    expect(hostDetail.currentMembership).toMatchObject({ role: 'HOST', joinOrder: 1 });
    expect(JSON.stringify(hostDetail.room)).not.toContain('birthYear');
    const otherUserId = await eligibleUser('Detail Visitor');
    const visitorDetail = await service.detail(otherUserId, openOne.room.id, now);
    expect(visitorDetail.currentMembership).toBeNull();
  });

  it('serializes contenders for the final seat and leaves no failed membership', async () => {
    const hostUserId = await eligibleUser('Concurrency Host');
    const firstUserId = await eligibleUser('First Contender');
    const secondUserId = await eligibleUser('Second Contender');
    const room = await service.create(
      hostUserId,
      { topic: 'One seat left', cefrLevel: 'B1', capacity: 2 },
      now,
    );

    const results = await Promise.allSettled([
      service.join(firstUserId, room.room.id, { rulesAccepted: true }, now),
      service.join(secondUserId, room.room.id, { rulesAccepted: true }, now),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: { code: 'ROOM_FULL' } });
    const memberships = await prisma.roomMembership.findMany({
      where: { roomId: room.room.id },
      orderBy: { joinOrder: 'asc' },
    });
    expect(memberships).toHaveLength(2);
    expect(memberships.map(({ joinOrder }) => joinOrder)).toEqual([1, 2]);
    expect(new Set(memberships.map(({ userId }) => userId)).size).toBe(2);
  });

  it('enforces eligibility, rules, password, expiry and idempotent membership writes', async () => {
    const hostUserId = await eligibleUser('Access Host');
    const memberUserId = await eligibleUser('Access Member');
    const passwordRoom = await service.create(
      hostUserId,
      { topic: 'Protected room', cefrLevel: 'B2', capacity: 4, password: '2468' },
      now,
    );

    await expect(
      service.join(memberUserId, passwordRoom.room.id, { rulesAccepted: false }, now),
    ).rejects.toMatchObject({ code: 'ROOM_RULES_NOT_ACCEPTED' });
    await expect(
      service.join(memberUserId, passwordRoom.room.id, { rulesAccepted: true }, now),
    ).rejects.toMatchObject({ code: 'ROOM_PASSWORD_REQUIRED' });
    await expect(
      service.join(
        memberUserId,
        passwordRoom.room.id,
        { rulesAccepted: true, password: '0000' },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ROOM_PASSWORD_INVALID' });

    const joined = await service.join(
      memberUserId,
      passwordRoom.room.id,
      { rulesAccepted: true, password: '2468' },
      now,
    );
    const repeated = await service.join(
      memberUserId,
      passwordRoom.room.id,
      { rulesAccepted: false },
      now,
    );
    expect(repeated.currentMembership?.id).toBe(joined.currentMembership?.id);
    expect(await prisma.roomMembership.count({ where: { roomId: passwordRoom.room.id } })).toBe(2);

    const incompleteUserId = randomUUID();
    await prisma.user.create({ data: { id: incompleteUserId, createdAt: now, updatedAt: now } });
    await expect(
      service.join(incompleteUserId, passwordRoom.room.id, { rulesAccepted: true }, now),
    ).rejects.toMatchObject({ code: 'PROFILE_REQUIRED' });

    const underageUserId = await eligibleUser('Initially Adult');
    await prisma.userProfile.update({
      where: { userId: underageUserId },
      data: { birthYear: 2015, birthMonth: 1 },
    });
    await expect(
      service.join(underageUserId, passwordRoom.room.id, { rulesAccepted: true }, now),
    ).rejects.toMatchObject({ code: 'AGE_RESTRICTED' });

    const expiredRoom = await service.create(
      hostUserId,
      { topic: 'Expired room', cefrLevel: 'B1', capacity: 4 },
      new Date(now.getTime() - 10_000_000),
    );
    await expect(
      service.join(memberUserId, expiredRoom.room.id, { rulesAccepted: true }, now),
    ).rejects.toMatchObject({ code: 'ROOM_ENDED' });
  });
});
