import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  LIVE_PUBLIC,
  LIVE_EXPIRIES,
  liveOwner,
} from '../../src/infrastructure/redis/live-stream.scripts.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { SocialService } from '../../src/modules/social/index.js';
import { DirectService } from '../../src/modules/direct/index.js';
import { LiveUpdatesService } from '../../src/modules/live-updates/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

describe('real PostgreSQL/Redis authenticated SSE', () => {
  let app: INestApplication,
    second: INestApplication,
    prisma: PrismaService,
    sessions: SessionService,
    redis: Redis,
    base: string,
    secondBase: string;
  let actors: Array<{ id: string; token: string; sessionId: string }>;
  const streams: Array<AbortController> = [];
  beforeAll(async () => {
    installTestEnvironment({
      REDIS_URL: process.env.SLOGAN_TEST_REDIS_URL ?? 'redis://127.0.0.1:56379',
    });
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    const other = await Test.createTestingModule({ imports: [AppModule] }).compile();
    second = other.createNestApplication();
    configureApiApp(second);
    await second.listen(0, '127.0.0.1');
    secondBase = await second.getUrl();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
    if (process.env.SLOGAN_TEST_DATABASE_URL) {
      const [target] = await prisma.$queryRaw<
        Array<{ name: string }>
      >`SELECT current_database() AS name`;
      expect(target!.name).toBe(new URL(process.env.SLOGAN_TEST_DATABASE_URL).pathname.slice(1));
    }
    redis = new Redis(process.env.SLOGAN_TEST_REDIS_URL ?? 'redis://127.0.0.1:56379');
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    await prisma.liveUpdateOutbox.deleteMany();
    await redis.del(LIVE_PUBLIC, LIVE_EXPIRIES);
    actors = [];
    for (const name of ['Alice SSE', 'Bob SSE', 'Outsider SSE']) {
      const user = await seedAdult(prisma, name);
      const pair = await sessions.issue(user.id);
      const identity = await sessions.verifyAccessToken(pair.accessToken);
      actors.push({ id: user.id, token: pair.accessToken, sessionId: identity.sessionId });
      await app.get(SocialService).heartbeat(user.id);
    }
  });
  afterEach(async () => {
    for (const stream of streams) stream.abort();
    streams.length = 0;
    await new Promise((resolve) => setTimeout(resolve, 1100));
  });
  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await prisma.liveUpdateOutbox.deleteMany();
    for (const actor of actors ?? [])
      await redis.del(liveOwner(actor.id), `social:presence:${actor.id}`);
    redis.disconnect();
    await second.close();
    await app.close();
  });
  async function open(
    actor: (typeof actors)[number],
    cursor?: string,
    origin = base,
    protocol = 1,
  ) {
    const controller = new AbortController();
    streams.push(controller);
    const response = await fetch(
      `${origin}/v1/me/live-updates${protocol === 2 ? '?protocol=2' : ''}`,
      {
        headers: {
          Authorization: `Bearer ${actor.token}`,
          ...(cursor ? { 'Last-Event-ID': cursor } : {}),
        },
        signal: controller.signal,
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    const initial = new TextDecoder().decode((await reader.read()).value);
    expect(initial).toContain('"scope":"reset"');
    return { reader, initial, controller };
  }
  async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, scope: string) {
    let value = '';
    while (!value.includes(`"scope":"${scope}"`)) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error('Stream closed');
      value += new TextDecoder().decode(chunk.value);
    }
    return value;
  }
  test('protocol2 targets chat content separately from reads and preserves the legacy parser vocabulary', async () => {
    const alice = actors[0]!,
      bob = actors[1]!,
      direct = app.get(DirectService);
    const conversation = await direct.open(alice.id, bob.id);
    const modern = await open(bob, undefined, base, 2),
      legacy = await open(alice);
    const message = await direct.send(
      alice.id,
      conversation.id,
      'Protocol2 private body',
      randomUUID(),
    );
    await app.get(LiveUpdatesService).recover();
    const typed = await readUntil(modern.reader, 'conversation-history');
    expect(typed).toContain(conversation.id);
    expect(typed).not.toContain('Protocol2 private body');
    const old = await readUntil(legacy.reader, 'messages');
    for (const match of old.matchAll(/data: (.+)/g)) {
      const event = JSON.parse(match[1]!);
      expect(['reset', 'rooms', 'partners', 'messages', 'renew']).toContain(event.scope);
      expect(Object.keys(event)).toEqual(['scope']);
    }
    const cursor = modern.initial.match(/id: ([^\n]+)/)![1]!;
    const foreignProtocol = await fetch(`${base}/v1/me/live-updates`, {
      headers: { Authorization: `Bearer ${bob.token}`, 'Last-Event-ID': cursor },
    });
    expect(foreignProtocol.status).toBe(400);
    modern.controller.abort();
    // A retained protocol2 continuation is ready, not a forced requery reset.
    const resumedControl = new AbortController();
    streams.push(resumedControl);
    const resumed = await fetch(`${base}/v1/me/live-updates?protocol=2`, {
      headers: { Authorization: `Bearer ${bob.token}`, 'Last-Event-ID': cursor },
      signal: resumedControl.signal,
    });
    const body = new TextDecoder().decode((await resumed.body!.getReader().read()).value);
    expect(body).toContain('"scope":"ready"');
    resumedControl.abort();
    await prisma.liveUpdateOutbox.deleteMany();
    await direct.read(bob.id, conversation.id, message.sequence);
    const changes = await prisma.liveUpdateOutbox.findMany({ where: { ownerId: bob.id } });
    expect(changes.some((e) => e.scope === 'unread')).toBe(true);
    expect(changes.some((e) => e.scope === 'conversation-history')).toBe(false);
  }, 15000);
  test('protocol2 rechecks host and membership permissions before releasing room references', async () => {
    const actor = actors[0]!,
      outsider = actors[2]!;
    const room = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: actor.id,
        topic: 'Scoped room',
        cefrLevel: 'B1',
        capacity: 4,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + 3600000),
        sensitiveSpeechDetectionEnabled: true,
      },
    });
    await prisma.roomMembership.create({
      data: {
        id: randomUUID(),
        roomId: room.id,
        userId: actor.id,
        role: 'HOST',
        lifecycle: 'ACTIVE',
        joinOrder: 1,
        rulesVersion: 'test',
        rulesAcceptedAt: new Date(),
        joinedAt: new Date(),
      },
    });
    const { RedisLiveUpdatesStore } =
      await import('../../src/modules/live-updates/infrastructure/redis-live-updates.store.js');
    const store = app.get(RedisLiveUpdatesStore);
    const change = { index: 1, id: '1-0', scope: 'room-safety' as const, resourceId: room.id };
    expect(await store.canReceive(actor.id, change)).toBe(true);
    expect(await store.canReceive(outsider.id, change)).toBe(false);
    const stream = await open(actor, undefined, base, 2);
    await prisma.roomMembership.updateMany({
      where: { roomId: room.id, userId: actor.id },
      data: { role: 'MEMBER', lifecycle: 'REMOVED', removedAt: new Date() },
    });
    expect(await store.canReceive(actor.id, change)).toBe(false);
    expect(await store.canReceive(actor.id, { ...change, scope: 'room-text' })).toBe(false);
    expect(
      await store.canReceive(actor.id, { ...change, scope: 'room-state', kind: 'membership' }),
    ).toBe(true);
    await app.get(LiveUpdatesService).recover();
    const terminal = await readUntil(stream.reader, 'room-state');
    expect(terminal).toContain(`"resourceId":"${room.id}"`);
    expect(terminal).toContain('"kind":"membership"');
  }, 15000);
  test('transactional publishers isolate invitations, room text, private learning and report progress; rollback and job churn stay silent', async () => {
    const [host, member, outsider] = actors;
    const room = await prisma.room.create({
      data: {
        id: randomUUID(),
        hostUserId: host!.id,
        topic: 'Publisher fixture',
        cefrLevel: 'B1',
        capacity: 4,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + 3600000),
        sensitiveSpeechDetectionEnabled: true,
      },
    });
    for (const [index, actor] of [host!, member!].entries())
      await prisma.roomMembership.create({
        data: {
          id: randomUUID(),
          roomId: room.id,
          userId: actor.id,
          role: index ? 'MEMBER' : 'HOST',
          lifecycle: 'ACTIVE',
          joinOrder: index + 1,
          rulesVersion: 'test',
          rulesAcceptedAt: new Date(),
          joinedAt: new Date(),
        },
      });
    await prisma.liveUpdateOutbox.deleteMany();
    const invitation = await prisma.roomInvitation.create({
      data: {
        id: randomUUID(),
        roomId: room.id,
        inviterUserId: host!.id,
        inviteeUserId: outsider!.id,
      },
    });
    let events = await prisma.liveUpdateOutbox.findMany({ where: { scope: 'invitations' } });
    expect(events.map((e) => e.ownerId).sort()).toEqual([host!.id, outsider!.id].sort());
    expect(events.every((e) => e.resourceId === room.id)).toBe(true);
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.userProfile.update({
      where: { userId: outsider!.id },
      data: { displayName: 'Changed invitee' },
    });
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'invitations' } }))
        .map((e) => e.ownerId)
        .sort(),
    ).toEqual([host!.id, outsider!.id].sort());

    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.roomInvitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED', resolvedAt: new Date() },
    });
    expect(await prisma.liveUpdateOutbox.count({ where: { scope: 'invitations' } })).toBe(2);
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.roomTextMessage.create({
      data: {
        id: randomUUID(),
        roomId: room.id,
        senderUserId: member!.id,
        senderDisplayName: 'Private member',
        clientRequestId: randomUUID(),
        text: 'Never in the event',
      },
    });
    events = await prisma.liveUpdateOutbox.findMany({ where: { scope: 'room-text' } });
    expect(events.map((e) => e.ownerId).sort()).toEqual([host!.id, member!.id].sort());
    expect(JSON.stringify(events)).not.toContain('Never in the event');
    await prisma.liveUpdateOutbox.deleteMany();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.roomNote.create({
          data: { roomId: room.id, userId: member!.id, content: 'Rolled back' },
        });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await prisma.liveUpdateOutbox.count()).toBe(0);
    const note = await prisma.roomNote.create({
      data: { roomId: room.id, userId: member!.id, content: 'Private note' },
    });
    events = await prisma.liveUpdateOutbox.findMany({ where: { scope: 'learning' } });
    expect(events.map((e) => e.ownerId)).toEqual([member!.id]);
    const summary = await prisma.roomKeywordSummary.create({
      data: { roomId: room.id, topicSnapshot: room.topic, extractorVersion: 'fixture' },
    });
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.roomKeywordSummary.update({
      where: { id: summary.id },
      data: { updatedAt: new Date() },
    });
    await prisma.roomNote.update({ where: { id: note.id }, data: { content: note.content } });
    expect(await prisma.liveUpdateOutbox.count()).toBe(0);
    await prisma.roomKeywordSummary.update({
      where: { id: summary.id },
      data: { status: 'UNAVAILABLE', failureCategory: 'fixture', version: { increment: 1 } },
    });
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'learning' } }))
        .map((e) => e.ownerId)
        .sort(),
    ).toEqual([host!.id, member!.id].sort());
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.speechProcessingConsentEvent.create({
      data: {
        id: randomUUID(),
        userId: member!.id,
        clientRequestId: randomUUID(),
        purpose: 'ROOM_SAFETY_DETECTION',
        action: 'ACCEPT',
        noticeVersion: 'fixture',
        providerCategory: 'fixture',
      },
    });
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'account' } })).map(
        (e) => e.ownerId,
      ),
    ).toEqual([member!.id]);
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'room-state' } }))
        .map((e) => e.ownerId)
        .sort(),
    ).toEqual([host!.id, member!.id].sort());
    const term = await prisma.roomKeywordSummaryItem.create({
      data: {
        summaryId: summary.id,
        kind: 'KEYWORD',
        displayText: 'Fixture',
        normalizedText: 'fixture',
        rank: 1,
      },
    });
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.vocabularyItem.create({
      data: {
        userId: member!.id,
        kind: 'KEYWORD',
        displayText: 'Fixture',
        normalizedText: 'fixture',
        sourceSummaryItemId: term.id,
      },
    });
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'learning' } })).map(
        (e) => e.ownerId,
      ),
    ).toEqual([member!.id]);
    const report = await prisma.report.create({
      data: {
        roomId: room.id,
        reporterUserId: member!.id,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'Private report',
      },
    });
    const safetyCase = await prisma.safetyCase.create({
      data: { reportId: report.id, roomId: room.id },
    });
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.safetyCase.update({
      where: { id: safetyCase.id },
      data: { assigneeUserId: host!.id, assignedAt: new Date(), version: { increment: 1 } },
    });
    expect(await prisma.liveUpdateOutbox.count()).toBe(0);
    await prisma.safetyCase.update({
      where: { id: safetyCase.id },
      data: { status: 'UNDER_REVIEW' },
    });
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'reports' } })).map(
        (e) => e.ownerId,
      ),
    ).toEqual([member!.id]);
    await prisma.liveUpdateOutbox.deleteMany();
    await prisma.roomSpeechRiskEvent.create({
      data: {
        id: randomUUID(),
        roomId: room.id,
        subjectUserId: member!.id,
        category: 'HARASSMENT_ABUSE',
        severity: 'LOW',
        ruleSetVersion: 'fixture',
        correlationHash: 'a'.repeat(64),
        firstOccurredAt: new Date(),
        lastOccurredAt: new Date(),
      },
    });
    expect(
      (await prisma.liveUpdateOutbox.findMany({ where: { scope: 'room-safety' } })).map(
        (e) => e.ownerId,
      ),
    ).toEqual([host!.id]);
    await prisma.liveUpdateOutbox.createMany({
      data: Array.from({ length: 750 }, () => ({ scope: 'learning', ownerId: member!.id })),
    });
    await app.get(LiveUpdatesService).recover();
    expect(await prisma.liveUpdateOutbox.count()).toBe(0);
  });
  test('restricted authenticated accounts retain self-service events but cannot consume social changes', async () => {
    const actor = actors[0]!,
      decider = actors[1]!;
    const conversation = await app.get(DirectService).open(decider.id, actor.id);
    const message = await app
      .get(DirectService)
      .send(decider.id, conversation.id, 'Restriction fixture', randomUUID());
    const report = await prisma.report.create({
      data: {
        directMessageId: message.id,
        targetUserId: decider.id,
        reporterUserId: actor.id,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'Restriction fixture',
      },
    });
    const safetyCase = await prisma.safetyCase.create({
      data: { reportId: report.id, targetUserId: actor.id },
    });
    await prisma.safetyRestriction.create({
      data: {
        caseId: safetyCase.id,
        userId: actor.id,
        kind: 'TEMPORARY',
        severity: 'GENERAL',
        reason: 'Fixture restriction',
        decidedByUserId: decider.id,
        appealDeadlineAt: new Date(Date.now() + 3600000),
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 3600000),
      },
    });
    const denied = await fetch(`${base}/v1/me/live-updates`, {
      headers: { Authorization: `Bearer ${actor.token}` },
    });
    expect(denied.status).toBe(403);
    const stream = await open(actor, undefined, base, 2);
    await prisma.liveUpdateOutbox.createMany({
      data: [{ scope: 'partners' }, { scope: 'rooms' }, { scope: 'safety', ownerId: actor.id }],
    });
    await app.get(LiveUpdatesService).recover();
    const events = await readUntil(stream.reader, 'safety');
    expect(events).not.toContain('"scope":"partners"');
    expect(events).not.toContain('"scope":"rooms"');
  }, 15000);
  test('committed private messages reach both participants but not a third account; foreign cursors fail', async () => {
    const [alice, bob, outsider] = actors as [
      (typeof actors)[number],
      (typeof actors)[number],
      (typeof actors)[number],
    ];
    const direct = app.get(DirectService);
    const conversation = await direct.open(alice.id, bob.id);
    const a = await open(alice),
      b = await open(bob, undefined, secondBase),
      c = await open(outsider);
    const waiting = c.reader.read().catch(() => null);
    await direct.send(alice.id, conversation.id, 'Private test content', randomUUID());
    await app.get(LiveUpdatesService).recover();
    const [one, two] = await Promise.all([
      readUntil(a.reader, 'messages'),
      readUntil(b.reader, 'messages'),
    ]);
    expect(one + two).not.toContain('Private test content');
    expect(one + two).not.toContain(alice.id);
    const third = await Promise.race([
      waiting,
      new Promise((resolve) => setTimeout(() => resolve(null), 1200)),
    ]);
    expect(third).toBeNull();
    c.controller.abort();
    await waiting.catch(() => undefined);
    const cursor = a.initial.match(/id: ([^\n]+)/)![1]!;
    const denied = await fetch(`${base}/v1/me/live-updates`, {
      headers: { Authorization: `Bearer ${outsider.token}`, 'Last-Event-ID': cursor },
    });
    expect(denied.status).toBe(400);
  }, 15000);
  test('room lifecycle writes from another instance invalidate discovery and partner projections', async () => {
    const actor = actors[0]!,
      peer = actors[1]!;
    const discovery = await open(actor),
      partners = await open(peer, undefined, secondBase);
    const room = await second.get(PrismaService).room.create({
      data: {
        id: randomUUID(),
        hostUserId: actor.id,
        topic: 'Transactional room event',
        cefrLevel: 'B1',
        capacity: 4,
        startedAt: new Date(),
        endsAt: new Date(Date.now() + 3600000),
      },
    });
    await second.get(LiveUpdatesService).recover();
    await Promise.all([
      readUntil(discovery.reader, 'rooms'),
      readUntil(partners.reader, 'partners'),
    ]);
    await second
      .get(PrismaService)
      .room.update({ where: { id: room.id }, data: { status: 'ENDED', endedAt: new Date() } });
    await second.get(LiveUpdatesService).recover();
    expect(await readUntil(discovery.reader, 'rooms')).not.toContain(room.id);
  });
  test('outbox rolls back with business writes and survives failed Redis publication', async () => {
    const before = await prisma.liveUpdateOutbox.count();
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.user.create({ data: { id: randomUUID() } });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await prisma.liveUpdateOutbox.count()).toBe(before);
    await redis.set(LIVE_PUBLIC, 'wrong-type');
    await expect(app.get(LiveUpdatesService).recover()).rejects.toThrow();
    expect(await prisma.liveUpdateOutbox.count()).toBe(before);
    await redis.del(LIVE_PUBLIC);
    await app.get(LiveUpdatesService).recover();
    expect(await prisma.liveUpdateOutbox.count()).toBeLessThan(before);
    expect(await redis.xlen(LIVE_PUBLIC)).toBeGreaterThan(0);
  });
  test('expired online leases invalidate partners without renewing candidates', async () => {
    const actor = actors[0]!,
      peer = actors[1]!;
    const stream = await open(actor);
    await redis.del(`social:presence:${peer.id}`);
    await redis.zadd(LIVE_EXPIRIES, 0, peer.id);
    await app.get(LiveUpdatesService).expirePresence(peer.id);
    const update = await readUntil(stream.reader, 'partners');
    expect(update).not.toContain(peer.id);
    expect(await redis.exists(`social:presence:${peer.id}`)).toBe(0);
  });
  test('presence expiry jobs fence older chains and renewed leases', async () => {
    const peer = actors[1]!,
      chain = `slogan:live:presence-chain:${peer.id}`;
    const live = app.get(LiveUpdatesService);
    const generation = randomUUID();
    await redis.set(chain, generation, 'EX', 300);
    const before = await redis.xlen(LIVE_PUBLIC);
    expect(await live.expirePresence(peer.id, randomUUID())).toBe(-1);
    expect(await live.expirePresence(peer.id, generation)).toBeGreaterThan(0);
    expect(await redis.get(chain)).toBe(generation);
    expect(await redis.xlen(LIVE_PUBLIC)).toBe(before);
    await redis.del(`social:presence:${peer.id}`);
    expect(await live.expirePresence(peer.id, generation)).toBe(0);
    expect(await redis.get(chain)).toBeNull();
    expect(await live.expirePresence(peer.id, generation)).toBe(-1);
    expect(await redis.xlen(LIVE_PUBLIC)).toBe(before + 1);
  });
  test('trimmed and reset Redis history reconnects with a current reset snapshot', async () => {
    const actor = actors[0]!,
      first = await open(actor);
    const cursor = first.initial.match(/id: ([^\n]+)/)![1]!;
    first.controller.abort();
    await redis.del(LIVE_PUBLIC, liveOwner(actor.id));
    await redis.xadd(LIVE_PUBLIC, '*', 'scope', 'rooms');
    const resumed = await open(actor, cursor);
    expect(resumed.initial).toContain('"scope":"reset"');
  });
  test.each([1, 2])(
    'protocol%s token expiry checkpoints and closes before credential expiry',
    async (protocol) => {
      const actor = actors[0]!,
        config = app.get(ConfigService);
      const token = await new JwtService().signAsync(
        { sid: actor.sessionId },
        {
          subject: actor.id,
          secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          issuer: config.getOrThrow<string>('JWT_ISSUER'),
          audience: config.getOrThrow<string>('JWT_AUDIENCE'),
          expiresIn: 3,
        },
      );
      const started = Date.now(),
        stream = await open({ ...actor, token }, undefined, base, protocol);
      const renewal = await readUntil(stream.reader, 'renew');
      if (protocol === 2) expect(renewal).toMatch(/^id: /m);
      expect(Date.now() - started).toBeLessThan(3500);
      expect((await stream.reader.read()).done).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 3200));
      expect(
        (
          await fetch(`${base}/v1/me/live-updates`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(401);
    },
    8500,
  );
  test('unauthenticated and malformed cursor requests never open an event stream', async () => {
    expect((await fetch(`${base}/v1/me/live-updates`)).status).toBe(401);
    expect(
      (
        await fetch(`${base}/v1/me/live-updates`, {
          headers: { Authorization: `Bearer ${actors[0]!.token}`, 'Last-Event-ID': 'invalid' },
        })
      ).status,
    ).toBe(400);
  });
  test('revoking a live session closes its stream within the authorization lease and prevents reentry', async () => {
    const actor = actors[0]!,
      stream = await open(actor);
    await sessions.revoke({ userId: actor.id, sessionId: actor.sessionId });
    const event = await readUntil(stream.reader, 'unavailable');
    expect(event).not.toContain(actor.token);
    expect(
      (
        await fetch(`${base}/v1/me/live-updates`, {
          headers: { Authorization: `Bearer ${actor.token}` },
        })
      ).status,
    ).toBe(401);
  }, 21000);
});
