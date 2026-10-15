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
    installTestEnvironment({ REDIS_URL: 'redis://127.0.0.1:56379' });
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
    redis = new Redis('redis://127.0.0.1:56379');
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
  async function open(actor: (typeof actors)[number], cursor?: string, origin = base) {
    const controller = new AbortController();
    streams.push(controller);
    const response = await fetch(`${origin}/v1/me/live-updates`, {
      headers: {
        Authorization: `Bearer ${actor.token}`,
        ...(cursor ? { 'Last-Event-ID': cursor } : {}),
      },
      signal: controller.signal,
    });
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
  test('a short actual token expiry renews and closes the response before credential expiry', async () => {
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
      stream = await open({ ...actor, token });
    await readUntil(stream.reader, 'renew');
    expect(Date.now() - started).toBeLessThan(3500);
    expect((await stream.reader.read()).done).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 3200));
    expect(
      (await fetch(`${base}/v1/me/live-updates`, { headers: { Authorization: `Bearer ${token}` } }))
        .status,
    ).toBe(401);
  }, 8500);
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
