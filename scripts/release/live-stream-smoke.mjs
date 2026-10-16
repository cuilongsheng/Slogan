// Authenticated hosting-chain verification using only short-lived, script-owned accounts.
// Credentials stay in memory; neither provider secrets nor user accounts are read.
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { assertMain } from './deployment-gate.mjs';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
requireApi('reflect-metadata');
const { PrismaPg } = requireApi('@prisma/adapter-pg');
const { PrismaClient } = await import('../../apps/api/dist/generated/prisma/client.js');
const { ScryptPasswordHasher } = await import('../../apps/api/dist/modules/auth/testing.js');
const local = process.env.SLOGAN_LIVE_SMOKE_LOCAL === '1' && process.env.NODE_ENV === 'test';
if (!local) {
  await import('./assert-production-target.mjs');
  await assertMain(process.env.SLOGAN_RELEASE_COMMIT);
}
const api = local ? 'http://127.0.0.1:3000' : 'https://slogan-api-pi.vercel.app';
const pages = local ? api : 'https://slogan-preview-mobile.pages.dev';
const sha = process.env.SLOGAN_RELEASE_COMMIT;
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const ids = [],
  streams = [],
  timings = [];
let conversation, room;
function check(value, code) {
  if (!value) throw new Error(code);
}
async function json(origin, path, token, body) {
  const response = await fetch(`${origin}/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  check(
    response.ok,
    `LIVE_SMOKE_HTTP_${path.startsWith('/auth/') ? 'LOGIN' : 'MESSAGE'}_${response.status}_FAILED`,
  );
  return response.json();
}
async function open(origin, token, cursor, protocol = 1) {
  const controller = new AbortController(),
    started = Date.now(),
    events = [];
  const response = await fetch(
    `${origin}/v1/me/live-updates${protocol === 2 ? '?protocol=2' : ''}`,
    {
      headers: { Authorization: `Bearer ${token}`, ...(cursor ? { 'Last-Event-ID': cursor } : {}) },
      signal: controller.signal,
    },
  );
  if (!local)
    check(response.headers.get('x-slogan-commit') === sha, 'LIVE_SMOKE_STREAM_COMMIT_FAILED');
  check(
    response.ok && response.headers.get('content-type')?.startsWith('text/event-stream'),
    'LIVE_SMOKE_HEADERS_FAILED',
  );
  check(
    /no-transform/.test(response.headers.get('cache-control') ?? ''),
    'LIVE_SMOKE_CACHE_FAILED',
  );
  const reader = response.body.getReader();
  let buffer = '',
    closed = false,
    lastId = '';
  const run = (async () => {
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        check(buffer.length < 65536, 'LIVE_SMOKE_BUFFER_FAILED');
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const id = frame.match(/^id: (.+)$/m)?.[1];
          if (id) lastId = id;
          const data = frame.match(/^data: (.+)$/m)?.[1];
          if (data) {
            const value = JSON.parse(data);
            check(
              typeof value.scope === 'string' &&
                (protocol === 1
                  ? Object.keys(value).length === 1 &&
                    ['reset', 'rooms', 'partners', 'messages', 'renew', 'unavailable'].includes(
                      value.scope,
                    )
                  : Object.keys(value).every((key) =>
                      ['scope', 'resourceId', 'kind'].includes(key),
                    )),
              'LIVE_SMOKE_PRIVATE_PAYLOAD_FAILED',
            );
            events.push({ ...value, at: Date.now(), id: lastId });
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) events.push({ scope: 'failed', at: Date.now() });
    } finally {
      closed = true;
      reader.releaseLock();
    }
  })();
  const stream = {
    events,
    controller,
    run,
    get closed() {
      return closed;
    },
    async wait(scope, timeout = 30000) {
      const until = Date.now() + timeout;
      while (!events.some((e) => e.scope === scope) && Date.now() < until && !closed)
        await delay(50);
      const event = events.find((e) => e.scope === scope);
      check(event, `LIVE_SMOKE_${scope.toUpperCase()}_FAILED`);
      return event;
    },
  };
  streams.push(stream);
  const reset = await stream.wait(protocol === 2 && cursor ? 'ready' : 'reset');
  timings.push({ path: origin === api ? 'api' : 'pages', resetMs: reset.at - started });
  return stream;
}
try {
  if (!local) {
    const until = Date.now() + 600000;
    let ready = false;
    while (Date.now() < until) {
      try {
        const response = await fetch(`${pages}/release.json`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        ready = response.ok && (await response.json()).commit === sha;
      } catch {
        /* Await the separately guarded Pages deployment. */
      }
      if (ready) break;
      await delay(10000);
    }
    check(ready, 'LIVE_SMOKE_PAGES_COMMIT_FAILED');
    await assertMain(sha);
  }
  const password = randomBytes(24).toString('base64url'),
    hash = await new ScryptPasswordHasher().hash(password);
  const actors = [];
  for (let i = 0; i < 3; i++) {
    const id = randomUUID(),
      username = `sse_${randomBytes(6).toString('hex')}`;
    ids.push(id);
    await db.user.create({
      data: {
        id,
        profile: {
          create: {
            avatarUrl: '',
            displayName: 'Release verification',
            nationalityCode: 'CN',
            interestCodes: [],
            cefrLevel: 'B1',
            birthYear: 2000,
            birthMonth: 1,
            completedAt: new Date(),
          },
        },
        emailCredential: {
          create: {
            username,
            email: `${username}@release.invalid`,
            passwordHash: hash,
            origin: 'EMAIL_VERIFIED',
            verifiedAt: new Date(),
          },
        },
      },
    });
    const login = await json(api, '/auth/password/exchange', undefined, { username, password });
    check(login.tokens?.accessToken, 'LIVE_SMOKE_LOGIN_FAILED');
    actors.push(login.tokens.accessToken);
  }
  const pair = [...ids.slice(0, 2)].sort();
  conversation = randomUUID();
  await db.directConversation.create({
    data: {
      id: conversation,
      userLowId: pair[0],
      userHighId: pair[1],
      initiatorUserId: ids[0],
      participants: { create: ids.slice(0, 2).map((userId) => ({ userId })) },
    },
  });
  const alice = await open(api, actors[0]),
    bob = await open(pages, actors[1]),
    outsider = await open(pages, actors[2]);
  const modernApi = await open(api, actors[0], undefined, 2),
    modernPages = await open(pages, actors[1], undefined, 2),
    modernOutsider = await open(pages, actors[2], undefined, 2);
  const sentAt = Date.now();
  await json(api, `/conversations/${conversation}/messages`, actors[0], {
    text: 'Owned release stream verification',
    clientRequestId: randomUUID(),
  });
  const [a, b] = await Promise.all([alice.wait('messages'), bob.wait('messages')]);
  timings.push({ apiMessageMs: a.at - sentAt, pagesMessageMs: b.at - sentAt });
  const typed = await Promise.all([
    modernApi.wait('conversation-history'),
    modernPages.wait('conversation-history'),
  ]);
  check(
    typed.every((event) => event.resourceId === conversation),
    'LIVE_SMOKE_TYPED_REFERENCE_FAILED',
  );
  await delay(2000);
  check(
    !outsider.events.some((e) => e.scope === 'messages') &&
      !modernOutsider.events.some((e) =>
        ['conversation-history', 'inbox', 'unread'].includes(e.scope),
      ),
    'LIVE_SMOKE_ACCOUNT_ISOLATION_FAILED',
  );
  // A script-owned long history proves the public latest/before/after contract.
  await db.$transaction(async (tx) => {
    await tx.directConversation.update({ where: { id: conversation }, data: { nextSequence: 66 } });
    await tx.directMessage.createMany({
      data: Array.from({ length: 64 }, (_, i) => ({
        id: randomUUID(),
        conversationId: conversation,
        senderUserId: ids[0],
        clientRequestId: randomUUID(),
        sequence: i + 2,
        text: 'Owned pagination verification',
      })),
    });
  });
  const latest = await json(pages, `/conversations/${conversation}/timeline?limit=20`, actors[1]);
  check(
    latest.items.length === 20 &&
      latest.items[0].value.sequence === 46 &&
      latest.items.at(-1).value.sequence === 65 &&
      latest.hasOlder,
    'LIVE_SMOKE_LATEST20_FAILED',
  );
  const older = await json(
    pages,
    `/conversations/${conversation}/timeline?limit=20&before=${encodeURIComponent(latest.nextBeforeCursor)}`,
    actors[1],
  );
  check(
    older.items.length === 20 &&
      older.items[0].value.sequence === 26 &&
      older.items.at(-1).value.sequence === 45,
    'LIVE_SMOKE_OLDER20_FAILED',
  );
  await json(api, `/conversations/${conversation}/messages`, actors[1], {
    text: 'Owned incremental verification',
    clientRequestId: randomUUID(),
  });
  const delta = await json(
    pages,
    `/conversations/${conversation}/timeline?limit=20&after=${encodeURIComponent(latest.syncCursor)}`,
    actors[1],
  );
  check(
    delta.items.length === 1 && delta.items[0].value.sequence === 66 && !delta.hasMoreChanges,
    'LIVE_SMOKE_DELTA20_FAILED',
  );
  // Separate API instances must recheck current host and membership at delivery.
  room = randomUUID();
  const now = new Date();
  await db.room.create({
    data: {
      id: room,
      hostUserId: ids[0],
      topic: 'Owned stream authorization verification',
      cefrLevel: 'B1',
      capacity: 4,
      startedAt: now,
      endsAt: new Date(now.getTime() + 600000),
      sensitiveSpeechDetectionEnabled: true,
      memberships: {
        create: ids.slice(0, 2).map((userId, i) => ({
          id: randomUUID(),
          userId,
          role: i === 0 ? 'HOST' : 'MEMBER',
          joinOrder: i + 1,
          rulesVersion: 'release-fixture',
          rulesAcceptedAt: now,
          joinedAt: now,
        })),
      },
    },
  });
  const waitNew = async (stream, scope, from) => {
    const until = Date.now() + 30000;
    for (;;) {
      const event = stream.events
        .slice(from)
        .find((e) => e.scope === scope && e.resourceId === room);
      if (event) return event;
      check(!stream.closed && Date.now() < until, 'LIVE_SMOKE_ROOM_AUDIENCE_FAILED');
      await delay(50);
    }
  };
  const risk = () =>
    db.roomSpeechRiskEvent.create({
      data: {
        id: randomUUID(),
        roomId: room,
        subjectUserId: ids[1],
        category: 'OTHER_SAFETY_RISK',
        severity: 'LOW',
        ruleSetVersion: 'release-fixture',
        correlationHash: randomBytes(32).toString('hex'),
        firstOccurredAt: new Date(),
        lastOccurredAt: new Date(),
      },
    });
  const hostStart = modernApi.events.length,
    memberStart = modernPages.events.length;
  await risk();
  await waitNew(modernApi, 'room-safety', hostStart);
  await delay(2000);
  check(
    !modernPages.events
      .slice(memberStart)
      .some((e) => e.scope === 'room-safety' && e.resourceId === room),
    'LIVE_SMOKE_NONHOST_ALERT_FAILED',
  );
  const formerStart = modernApi.events.length,
    successorStart = modernPages.events.length;
  await db.$transaction(async (tx) => {
    await tx.roomMembership.updateMany({
      where: { roomId: room, userId: ids[0] },
      data: { role: 'MEMBER' },
    });
    await tx.roomMembership.updateMany({
      where: { roomId: room, userId: ids[1] },
      data: { role: 'HOST' },
    });
    await tx.room.update({ where: { id: room }, data: { hostUserId: ids[1] } });
  });
  await risk();
  await waitNew(modernPages, 'room-safety', successorStart);
  await delay(2000);
  check(
    !modernApi.events
      .slice(formerStart)
      .some((e) => e.scope === 'room-safety' && e.resourceId === room),
    'LIVE_SMOKE_FORMER_HOST_FAILED',
  );
  const removedStart = modernApi.events.length;
  await db.roomMembership.updateMany({
    where: { roomId: room, userId: ids[0] },
    data: { lifecycle: 'REMOVED', removedAt: new Date() },
  });
  await waitNew(modernApi, 'room-state', removedStart);
  const removedTextStart = modernApi.events.length,
    memberTextStart = modernPages.events.length;
  await db.roomTextMessage.create({
    data: {
      id: randomUUID(),
      roomId: room,
      senderUserId: ids[1],
      senderDisplayName: 'Release verification',
      clientRequestId: randomUUID(),
      text: 'Owned member-delivery verification',
    },
  });
  await waitNew(modernPages, 'room-text', memberTextStart);
  await delay(2000);
  check(
    !modernApi.events
      .slice(removedTextStart)
      .some((e) => e.scope === 'room-text' && e.resourceId === room),
    'LIVE_SMOKE_REMOVED_MEMBER_FAILED',
  );
  check(
    !modernOutsider.events.some(
      (e) => ['room-state', 'room-text', 'room-safety'].includes(e.scope) && e.resourceId === room,
    ),
    'LIVE_SMOKE_ROOM_OUTSIDER_FAILED',
  );
  const protocolMismatch = await fetch(`${pages}/v1/me/live-updates`, {
    headers: { Authorization: `Bearer ${actors[0]}`, 'Last-Event-ID': modernApi.events[0].id },
    signal: AbortSignal.timeout(30000),
  });
  check(protocolMismatch.status === 400, 'LIVE_SMOKE_PROTOCOL_CURSOR_FAILED');
  await protocolMismatch.body?.cancel();
  const foreign = await fetch(`${pages}/v1/me/live-updates`, {
    headers: { Authorization: `Bearer ${actors[2]}`, 'Last-Event-ID': alice.events[0].id },
    signal: AbortSignal.timeout(30000),
  });
  check(foreign.status === 400, 'LIVE_SMOKE_CURSOR_ISOLATION_FAILED');
  await foreign.body?.cancel();
  await db.authSession.updateMany({ where: { userId: ids[2] }, data: { revokedAt: new Date() } });
  await Promise.all([
    outsider.wait('unavailable', 22000),
    modernOutsider.wait('unavailable', 22000),
  ]);
  if (!local) {
    const renew = await bob.wait('renew', 245000);
    timings.push({ pagesLeaseMs: renew.at - bob.events[0].at });
    check(renew.at - bob.events[0].at <= 245000, 'LIVE_SMOKE_LEASE_FAILED');
    await modernPages.wait('renew', 245000);
  }
  const resumed = await open(pages, actors[0], alice.events.at(-1)?.id);
  resumed.controller.abort();
  const modernResumed = await open(pages, actors[0], modernApi.events.at(-1)?.id, 2);
  modernResumed.controller.abort();
  process.stdout.write(
    JSON.stringify({
      status: 'SUCCEEDED',
      commit: sha ?? 'local',
      checks: [
        'protocol2-progressive',
        'legacy-coexistence',
        'protocol-cursor-isolation',
        'latest20-older20-delta20',
        'api-progressive',
        'pages-progressive',
        'private-participants',
        'current-host-role-transfer',
        'removed-member-terminal-only',
        'room-outsider-isolation',
        'third-account-isolation',
        'foreign-cursor',
        'session-revocation',
        'reset-recovery',
        'client-abort',
        ...(!local ? ['bounded-lease-renewal'] : []),
      ],
      timings,
    }) + '\n',
  );
} catch (error) {
  process.stderr.write(
    `${/^LIVE_SMOKE_[A-Z0-9_]+$/.test(error.message ?? '') ? error.message : 'LIVE_SMOKE_FAILED'}\n`,
  );
  process.exitCode = 1;
} finally {
  for (const stream of streams) stream.controller.abort();
  await Promise.allSettled(streams.map((s) => s.run));
  try {
    await db.$transaction(async (tx) => {
      if (room) {
        await tx.room.delete({ where: { id: room } });
        await tx.liveUpdateOutbox.deleteMany({ where: { resourceId: room } });
      }
      if (conversation) {
        await tx.directMessage.deleteMany({ where: { conversationId: conversation } });
        await tx.directConversationMember.deleteMany({ where: { conversationId: conversation } });
        await tx.directConversation.deleteMany({ where: { id: conversation } });
      }
      await tx.directCommand.deleteMany({ where: { actorUserId: { in: ids } } });
      await tx.refreshToken.deleteMany({ where: { session: { userId: { in: ids } } } });
      await tx.authSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.emailCredential.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
      await tx.liveUpdateOutbox.deleteMany({ where: { ownerId: { in: ids } } });
    });
    process.stdout.write('{"ownedFixtureCleanup":"SUCCEEDED"}\n');
  } catch {
    process.stderr.write('LIVE_SMOKE_OWNED_CLEANUP_FAILED\n');
    process.exitCode = 1;
  }
  await db.$disconnect();
}
