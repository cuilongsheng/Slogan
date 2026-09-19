import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AppointmentsService, RoomHistoryService } from '../../src/modules/rooms/testing.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';
import { installTestEnvironment } from '../fixtures/environment.js';

describe('room history and private notes on PostgreSQL', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let history: RoomHistoryService;
  let rooms: RoomsService;
  let appointments: AppointmentsService;
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    installTestEnvironment();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = moduleRef.get(PrismaService);
    history = moduleRef.get(RoomHistoryService);
    rooms = moduleRef.get(RoomsService);
    appointments = moduleRef.get(AppointmentsService);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    userId = (await seedAdult(prisma, 'History user')).id;
    otherId = (await seedAdult(prisma, 'Other user')).id;
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await moduleRef.close();
  });

  async function instant(
    at: Date,
    lifecycle: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'INVITED' = 'ACTIVE',
  ) {
    const roomId = (
      await rooms.create(
        userId,
        { topic: `History ${at.getTime()}`, cefrLevel: 'B1', capacity: 3 },
        at,
      )
    ).room.id;
    await prisma.room.update({ where: { id: roomId }, data: { status: 'ENDED', endedAt: at } });
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lifecycle },
    });
    return roomId;
  }

  async function reserved(status: 'BOOKED' | 'CANCELLED' | 'EXPIRED', offset: number) {
    const start = new Date(Date.now() + 600_000 + offset);
    const room = await appointments.create(otherId, {
      topic: `Reservation ${status} ${offset}`,
      cefrLevel: 'B1',
      capacity: 3,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 3_600_000).toISOString(),
    });
    await appointments.reserve(userId, room.id, {
      rulesAccepted: true,
      expectedReservationVersion: 0,
    });
    if (status !== 'BOOKED') {
      await prisma.roomReservation.update({
        where: { roomId_userId: { roomId: room.id, userId } },
        data: { status },
      });
    }
    return room.id;
  }

  it('unions every retained lifecycle, keeps reservation-only states, and de-duplicates consumed reservations', async () => {
    for (const [index, lifecycle] of ['ACTIVE', 'LEFT', 'REMOVED', 'INVITED'].entries()) {
      await instant(new Date(Date.now() - index * 1000), lifecycle as never);
    }
    for (const [index, status] of ['BOOKED', 'CANCELLED', 'EXPIRED'].entries()) {
      await reserved(status as never, index * 1000);
    }
    const consumedRoom = await reserved('BOOKED', 4000);
    expect(
      (await history.list(userId, { limit: 20 })).items.find(
        (item) => item.roomId === consumedRoom,
      ),
    ).toMatchObject({ relationship: 'RESERVED_ONLY', reservationStatus: 'BOOKED' });
    await prisma.room.update({
      where: { id: consumedRoom },
      data: {
        status: 'OPEN',
        startedAt: new Date(Date.now() - 1000),
        initialHostDeadline: new Date(Date.now() + 299_000),
      },
    });
    await rooms.join(userId, consumedRoom, { rulesAccepted: true });
    await prisma.room.update({
      where: { id: consumedRoom },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    await history.saveNote(userId, consumedRoom, {
      content: 'Closed-loop reflection',
      expectedVersion: 0,
    });
    await expect(history.getNote(userId, consumedRoom)).resolves.toMatchObject({
      content: 'Closed-loop reflection',
      version: 1,
    });
    await history.saveNote(userId, consumedRoom, { content: '', expectedVersion: 1 });

    const page = await history.list(userId, { limit: 20 });
    expect(page.items).toHaveLength(8);
    expect(new Set(page.items.map((item) => item.roomId)).size).toBe(8);
    expect(page.items.filter((item) => item.relationship === 'PARTICIPATED')).toHaveLength(5);
    expect(
      page.items
        .filter((item) => item.relationship === 'RESERVED_ONLY')
        .map((item) => item.reservationStatus)
        .sort(),
    ).toEqual(['BOOKED', 'CANCELLED', 'EXPIRED']);
    expect((await history.list(otherId, { limit: 20 })).items).toHaveLength(4);
  });

  it('uses a stable timestamp/id cursor without duplicate rows when a newer row appears', async () => {
    const base = Date.now() - 10_000;
    const ids = await Promise.all([
      instant(new Date(base)),
      instant(new Date(base)),
      instant(new Date(base - 1000)),
      instant(new Date(base - 2000)),
    ]);
    const first = await history.list(userId, { limit: 2 });
    expect(first.nextCursor).not.toBeNull();
    await instant(new Date(base + 1000));
    const second = await history.list(userId, { limit: 2, cursor: first.nextCursor! });
    expect(new Set([...first.items, ...second.items].map((item) => item.roomId)).size).toBe(4);
    expect([...first.items, ...second.items].map((item) => item.roomId)).toEqual(
      expect.arrayContaining(ids),
    );
    await expect(history.list(userId, { cursor: 'invalid' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('serializes different edits, safely retries the winner, and keeps private notes isolated', async () => {
    const roomId = (
      await rooms.create(userId, {
        topic: 'Private notes',
        cefrLevel: 'B1',
        capacity: 3,
      })
    ).room.id;
    await rooms.join(otherId, roomId, { rulesAccepted: true });
    await prisma.room.update({ where: { id: roomId }, data: { status: 'ENDED' } });
    expect(await history.getNote(userId, roomId)).toEqual({
      content: null,
      version: 0,
      updatedAt: null,
    });

    const attempts = await Promise.allSettled([
      history.saveNote(userId, roomId, { content: 'first edit', expectedVersion: 0 }),
      history.saveNote(userId, roomId, { content: 'second edit', expectedVersion: 0 }),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = attempts.find((result) => result.status === 'fulfilled')!;
    const saved = winner.status === 'fulfilled' ? winner.value : undefined;
    expect(saved?.version).toBe(1);
    expect(
      await history.saveNote(userId, roomId, {
        content: saved!.content!,
        expectedVersion: 0,
      }),
    ).toMatchObject({ version: 1, content: saved!.content });
    expect(await history.getNote(otherId, roomId)).toMatchObject({ content: null, version: 0 });
  });

  it('keeps a version tombstone after clearing and rejects stale resurrection', async () => {
    const roomId = await instant(new Date());
    await history.saveNote(userId, roomId, { content: 'retain until clear', expectedVersion: 0 });
    const cleared = await history.saveNote(userId, roomId, { content: ' \n ', expectedVersion: 1 });
    expect(cleared).toMatchObject({ content: null, version: 2 });
    expect(
      await history.saveNote(userId, roomId, { content: '', expectedVersion: 1 }),
    ).toMatchObject({ content: null, version: 2 });
    await expect(
      history.saveNote(userId, roomId, { content: 'stale text', expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: 'NOTE_VERSION_CONFLICT' });
    expect(await prisma.roomNote.count()).toBe(1);
  });

  it('requires actual historical membership and an ended state', async () => {
    const open = (await rooms.create(userId, { topic: 'Still open', cefrLevel: 'B1', capacity: 2 }))
      .room.id;
    await expect(history.getNote(userId, open)).rejects.toMatchObject({ code: 'ROOM_NOT_ENDED' });

    const booked = await reserved('BOOKED', 0);
    await prisma.room.update({ where: { id: booked }, data: { status: 'ENDED' } });
    await expect(history.getNote(userId, booked)).rejects.toMatchObject({
      code: 'HISTORY_CONTEXT_NOT_FOUND',
    });
    await expect(history.getNote(userId, crypto.randomUUID())).rejects.toMatchObject({
      code: 'HISTORY_CONTEXT_NOT_FOUND',
    });

    const removed = await instant(new Date(), 'REMOVED');
    await expect(
      history.saveNote(userId, removed, { content: 'private', expectedVersion: 0 }),
    ).resolves.toMatchObject({ version: 1 });
  });

  it('rolls back note creation when the database rejects the write', async () => {
    const roomId = await instant(new Date());
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION test_note_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected note failure'; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER test_note_failure BEFORE INSERT ON "RoomNote" FOR EACH ROW EXECUTE FUNCTION test_note_failure()`,
    );
    try {
      await expect(
        history.saveNote(userId, roomId, { content: 'will fail', expectedVersion: 0 }),
      ).rejects.toThrow('injected note failure');
      expect(await prisma.roomNote.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER test_note_failure ON "RoomNote"');
      await prisma.$executeRawUnsafe('DROP FUNCTION test_note_failure()');
    }
  });
});
