import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../src/config/environment.js';
import { randomUUID } from 'node:crypto';
import { Test, type TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { ReportsService } from '../../src/modules/moderation/index.js';
import { DirectService } from '../../src/modules/direct/index.js';
import {
  ACCOUNT_LIFECYCLE_REPOSITORY,
  type AccountLifecycleRepository,
} from '../../src/modules/account-lifecycle/index.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import {
  SOCIAL_PRESENCE,
  SocialService,
  type SocialPresence,
} from '../../src/modules/social/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  clearRealtimeFixtures,
  seedAdult,
  realtimeEnvironment,
  FakeRealtimeProvider,
} from '../fixtures/realtime.js';
class Presence implements SocialPresence {
  readonly users = new Set<string>();
  async refresh(id: string) {
    this.users.add(id);
    return { expiresAt: new Date(Date.now() + 90_000), refreshAfterSeconds: 45 };
  }
  async online(ids: string[]) {
    return new Set(ids.filter((id) => this.users.has(id)));
  }
  async clear(id: string) {
    this.users.delete(id);
  }
}
describe('private conversations and exclusive two-party voice', () => {
  let moduleRef: TestingModule,
    prisma: PrismaService,
    direct: DirectService,
    rooms: RoomsService,
    social: SocialService;
  let alice: string, bob: string, outsider: string, conversationId: string;
  const presence = new Presence();
  beforeAll(async () => {
    installTestEnvironment(realtimeEnvironment());
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(realtimeEnvironment()))
      .overrideProvider(SOCIAL_PRESENCE)
      .useValue(presence)
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(new FakeRealtimeProvider())
      .compile();
    prisma = moduleRef.get(PrismaService);
    direct = moduleRef.get(DirectService);
    rooms = moduleRef.get(RoomsService);
    social = moduleRef.get(SocialService);
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    presence.users.clear();
    alice = (await seedAdult(prisma, 'Direct Alice')).id;
    bob = (await seedAdult(prisma, 'Direct Bob')).id;
    outsider = (await seedAdult(prisma, 'Direct Outsider')).id;
    await Promise.all([presence.refresh(alice), presence.refresh(bob), presence.refresh(outsider)]);
    conversationId = (await direct.open(alice, bob)).id;
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await moduleRef.close();
  });
  it('replays concurrent sends once, rejects altered identifiers, and keeps personal visibility separate', async () => {
    const id = randomUUID();
    const results = await Promise.all([
      direct.send(alice, conversationId, ' Hello ', id),
      direct.send(alice, conversationId, 'Hello', id),
    ]);
    expect(results[0]?.id).toBe(results[1]?.id);
    expect(await prisma.directMessage.count()).toBe(1);
    await expect(direct.send(alice, conversationId, 'Changed', id)).rejects.toMatchObject({
      code: 'DIRECT_REQUEST_CONFLICT',
    });
    await expect(direct.messages(outsider, conversationId, {})).rejects.toMatchObject({
      code: 'DIRECT_NOT_FOUND',
    });
    expect((await direct.detail(bob, conversationId)).unreadCount).toBe(1);
    await direct.hide(bob, conversationId, randomUUID());
    expect((await direct.messages(bob, conversationId, {})).items).toHaveLength(0);
    expect((await direct.messages(alice, conversationId, {})).items).toHaveLength(1);
    await direct.send(alice, conversationId, 'New', randomUUID());
    expect((await direct.messages(bob, conversationId, {})).items.map((row) => row.text)).toEqual([
      'New',
    ]);
    expect((await direct.conversations(bob, {})).items).toHaveLength(1);
  });
  it('counts only the actor incoming unread text across conversations, respecting read and hide boundaries', async () => {
    const first = await direct.send(alice, conversationId, 'First', randomUUID());
    const second = await direct.send(alice, conversationId, 'Second', randomUUID());
    expect(await direct.unreadCount(alice)).toBe(0);
    expect(await direct.unreadCount(bob)).toBe(2);
    expect(await direct.unreadCount(outsider)).toBe(0);
    await direct.read(bob, conversationId, first.sequence);
    expect(await direct.unreadCount(bob)).toBe(1);
    const other = await direct.open(outsider, bob);
    await direct.send(outsider, other.id, 'Another conversation', randomUUID());
    expect(await direct.unreadCount(bob)).toBe(2);
    await direct.hide(bob, conversationId, randomUUID());
    expect(await direct.unreadCount(bob)).toBe(1);
    expect(await direct.unreadCount(alice)).toBe(0);
    await direct.read(bob, other.id, (await direct.messages(bob, other.id, {})).items[0]!.sequence);
    await direct.requestCall(alice, conversationId, randomUUID());
    expect(await direct.unreadCount(bob)).toBe(0);
    await expect(direct.unreadCount(randomUUID())).rejects.toMatchObject({
      code: 'DIRECT_TARGET_UNAVAILABLE',
    });
    expect(second.sequence).toBeGreaterThan(first.sequence);
  });
  it('limits unsolicited consecutive text and stops both directions after blocking', async () => {
    for (let index = 0; index < 3; index++)
      await direct.send(alice, conversationId, `Message ${index}`, randomUUID());
    await expect(direct.send(alice, conversationId, 'Fourth', randomUUID())).rejects.toMatchObject({
      code: 'DIRECT_RATE_LIMITED',
    });
    await direct.send(bob, conversationId, 'Reply', randomUUID());
    await direct.send(alice, conversationId, 'After reply', randomUUID());
    await social.createBlock(
      bob,
      { targetUserId: alice, clientRequestId: randomUUID() },
      new Date(),
    );
    for (const user of [alice, bob])
      await expect(
        direct.send(user, conversationId, 'Blocked', randomUUID()),
      ).rejects.toMatchObject({ code: 'DIRECT_TARGET_UNAVAILABLE' });
  });
  it('reports only visible incoming messages and retains evidence after personal deletion', async () => {
    const sent = await direct.send(alice, conversationId, 'Reported example', randomUUID());
    await expect(
      direct.report(outsider, conversationId, sent.id, 'OTHER', 'Not participant', randomUUID()),
    ).rejects.toMatchObject({ code: 'DIRECT_NOT_FOUND' });
    const requestId = randomUUID(),
      receipt = await direct.report(
        bob,
        conversationId,
        sent.id,
        'OTHER',
        'Unwanted message',
        requestId,
      );
    expect(
      (await direct.report(bob, conversationId, sent.id, 'OTHER', 'Unwanted message', requestId))
        .id,
    ).toBe(receipt.id);
    await direct.hide(bob, conversationId, randomUUID());
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: receipt.id },
      include: { directMessage: true },
    });
    const history = await moduleRef.get(ReportsService).listOwn(bob, {});
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({
      id: receipt.id,
      caseId: receipt.caseId,
      kind: 'DIRECT_MESSAGE',
      roomTopic: null,
      status: 'OPEN',
    });
    expect(JSON.stringify(history)).not.toContain('Reported example');
    expect(JSON.stringify(history)).not.toContain('Unwanted message');
    expect((await moduleRef.get(ReportsService).listOwn(alice, {})).items).toEqual([]);
    expect(report.roomId).toBeNull();
    expect(report.directMessage?.text).toBe('Reported example');
    expect(
      (await prisma.safetyCase.findUniqueOrThrow({ where: { id: receipt.caseId } })).roomId,
    ).toBeNull();
  });
  it('serializes call reservation against concurrent room creation', async () => {
    const results = await Promise.allSettled([
      direct.requestCall(alice, conversationId, randomUUID()),
      rooms.create(alice, { topic: 'Mutual exclusion', capacity: 2, cefrLevel: 'B1' }),
    ]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await prisma.directCallOccupancy.count({ where: { userId: alice } })) +
        (await prisma.roomMembership.count({ where: { userId: alice, lifecycle: 'ACTIVE' } })),
    ).toBe(1);
  });
  it('requires callee consent, rejects third parties, and releases occupancy on block', async () => {
    const call = await direct.requestCall(alice, conversationId, randomUUID());
    await expect(direct.credentials(alice, call.id)).rejects.toMatchObject({
      code: 'DIRECT_CALL_UNAVAILABLE',
    });
    await expect(direct.call(outsider, call.id)).rejects.toMatchObject({
      code: 'DIRECT_NOT_FOUND',
    });
    await expect(direct.actCall(alice, call.id, 'accept', randomUUID())).rejects.toMatchObject({
      code: 'DIRECT_CALL_UNAVAILABLE',
    });
    const history = await direct.callHistory(bob, conversationId, {});
    await direct.actCall(bob, call.id, 'accept', randomUUID());
    expect(
      (await direct.callHistory(bob, conversationId, { cursor: history.nextCursor! })).items[0]
        ?.status,
    ).toBe('ACTIVE');
    await social.createBlock(
      bob,
      { targetUserId: alice, clientRequestId: randomUUID() },
      new Date(),
    );
    expect((await direct.call(alice, call.id)).status).toBe('ENDED');
    expect(await prisma.directCallOccupancy.count()).toBe(0);
    expect(
      (await prisma.directCall.findUniqueOrThrow({ where: { id: call.id } })).cleanupStatus,
    ).toBe('PENDING');
  });
  it('ends calls and removes uploaded avatars atomically when an account is deleted', async () => {
    const call = await direct.requestCall(alice, conversationId, randomUUID());
    await direct.actCall(bob, call.id, 'accept', randomUUID());
    const lifecycle = moduleRef.get<AccountLifecycleRepository>(ACCOUNT_LIFECYCLE_REPOSITORY);
    await lifecycle.deleteAccount({
      userId: alice,
      clientRequestId: randomUUID(),
      payloadHash: 'direct-delete',
      now: new Date(),
    });
    expect(await prisma.directCallOccupancy.count()).toBe(0);
    expect(await prisma.profileAvatar.count({ where: { userId: alice } })).toBe(0);
    expect((await prisma.directCall.findUniqueOrThrow({ where: { id: call.id } })).endReason).toBe(
      'ACCOUNT_DELETED',
    );
    await expect(direct.credentials(bob, call.id)).rejects.toMatchObject({
      code: 'DIRECT_CALL_UNAVAILABLE',
    });
  });
  it('commits ringing expiry and makes stale acceptance harmless', async () => {
    const call = await direct.requestCall(alice, conversationId, randomUUID());
    await prisma.directCall.update({
      where: { id: call.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(direct.actCall(bob, call.id, 'accept', randomUUID())).rejects.toMatchObject({
      code: 'DIRECT_CALL_UNAVAILABLE',
    });
    expect((await prisma.directCall.findUniqueOrThrow({ where: { id: call.id } })).status).toBe(
      'EXPIRED',
    );
    expect(await prisma.directCallOccupancy.count()).toBe(0);
  });
});
