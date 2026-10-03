import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import {
  SOCIAL_PRESENCE,
  type SocialPresence,
} from '../../src/modules/social/domain/ports/presence.port.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

class HttpPresence implements SocialPresence {
  readonly onlineUsers = new Set<string>();
  async refresh(userId: string) {
    this.onlineUsers.add(userId);
    return { expiresAt: new Date(Date.now() + 90_000), refreshAfterSeconds: 45 };
  }
  async online(userIds: string[]) {
    return new Set(userIds.filter((userId) => this.onlineUsers.has(userId)));
  }
  async clear(userId: string) {
    this.onlineUsers.delete(userId);
  }
}

describe('social and room invitation HTTP contract', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  const presence = new HttpPresence();
  let alice: { id: string; token: string };
  let bob: { id: string; token: string };
  let charlie: { id: string; token: string };

  beforeAll(async () => {
    installTestEnvironment();
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .overrideProvider(SOCIAL_PRESENCE)
      .useValue(presence)
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    presence.onlineUsers.clear();
    const users = await Promise.all([
      seedAdult(prisma, 'Alice Social'),
      seedAdult(prisma, 'Bob Social'),
      seedAdult(prisma, 'Charlie Social'),
    ]);
    const tokens = await Promise.all(users.map((user) => sessions.issue(user.id)));
    alice = { id: users[0]!.id, token: tokens[0]!.accessToken };
    bob = { id: users[1]!.id, token: tokens[1]!.accessToken };
    charlie = { id: users[2]!.id, token: tokens[2]!.accessToken };
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });

  const auth = (user: { token: string }) => ({ authorization: `Bearer ${user.token}` });

  async function friends() {
    const created = await request(app.getHttpServer())
      .post('/v1/friend-requests')
      .set(auth(alice))
      .send({ targetUserId: bob.id, clientRequestId: randomUUID() })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/friend-requests/${created.body.id}/accept`)
      .set(auth(bob))
      .send({ clientRequestId: randomUUID() })
      .expect(200);
    return created.body.id as string;
  }

  it('shows the other participant public name only in the caller-owned pending request list', async () => {
    await request(app.getHttpServer())
      .post('/v1/friend-requests')
      .set(auth(alice))
      .send({ targetUserId: bob.id, clientRequestId: randomUUID() })
      .expect(201);
    const incoming = await request(app.getHttpServer())
      .get('/v1/friend-requests?direction=incoming')
      .set(auth(bob))
      .expect(200);
    expect(incoming.body.items).toHaveLength(1);
    expect(incoming.body.items[0].peerDisplayName).toBe('Alice Social');
    expect(Object.keys(incoming.body.items[0]).sort()).toEqual([
      'createdAt', 'id', 'peerDisplayName', 'recipientUserId', 'requesterUserId', 'resolvedAt', 'status',
    ].sort());
    expect(JSON.stringify(incoming.body)).not.toMatch(/birthYear|birthMonth|email/);
    const outgoing = await request(app.getHttpServer())
      .get('/v1/friend-requests?direction=outgoing')
      .set(auth(alice))
      .expect(200);
    expect(outgoing.body.items[0].peerDisplayName).toBe('Bob Social');
    expect((await request(app.getHttpServer())
      .get('/v1/friend-requests?direction=incoming')
      .set(auth(charlie))
      .expect(200)).body.items).toEqual([]);
  });

  it('requires mutual consent and exposes only caller-owned social lists', async () => {
    const requestId = await friends();
    const list = await request(app.getHttpServer())
      .get('/v1/me/friends')
      .set(auth(alice))
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(Object.keys(list.body.items[0].friend).sort()).toEqual(
      [
        'avatarUrl',
        'cefrLevel',
        'city',
        'displayName',
        'interestCodes',
        'nationalityCode',
        'userId',
      ].sort(),
    );
    expect(JSON.stringify(list.body)).not.toContain('birthYear');
    await request(app.getHttpServer())
      .post(`/v1/friend-requests/${requestId}/reject`)
      .set(auth(charlie))
      .send({ clientRequestId: randomUUID() })
      .expect(404);
    await request(app.getHttpServer()).get('/v1/me/friends').expect(401);
    await request(app.getHttpServer())
      .get('/v1/friend-requests?direction=incoming&cursor=bad')
      .set(auth(bob))
      .expect(400);
  });

  it('hides both directions after blocking and rejects forged heartbeat fields', async () => {
    await friends();
    await request(app.getHttpServer())
      .post('/v1/me/presence/heartbeat')
      .set(auth(bob))
      .send({})
      .expect(200);
    expect(
      (
        await request(app.getHttpServer()).get('/v1/people/available').set(auth(alice)).expect(200)
      ).body.items.map((item: { userId: string }) => item.userId),
    ).toContain(bob.id);
    await request(app.getHttpServer())
      .post('/v1/blocks')
      .set(auth(alice))
      .send({ targetUserId: bob.id, clientRequestId: randomUUID() })
      .expect(201);
    expect(
      (
        await request(app.getHttpServer()).get('/v1/people/available').set(auth(alice)).expect(200)
      ).body.items.map((item: { userId: string }) => item.userId),
    ).not.toContain(bob.id);
    expect(
      (await request(app.getHttpServer()).get('/v1/me/friends').set(auth(bob)).expect(200)).body
        .items,
    ).toEqual([]);
    await request(app.getHttpServer())
      .post('/v1/me/presence/heartbeat')
      .set(auth(bob))
      .send({ userId: alice.id, expiresAt: new Date().toISOString() })
      .expect(400);
  });

  it('invites through HTTP and consumes only after all join checks pass', async () => {
    await friends();
    const room = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(auth(alice))
      .send({ topic: 'Social HTTP room', cefrLevel: 'B2', capacity: 2, password: '1234' })
      .expect(201);
    const invitation = await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/invitations`)
      .set(auth(alice))
      .send({ targetUserId: bob.id, clientRequestId: randomUUID() })
      .expect(201);
    const mine = await request(app.getHttpServer())
      .get('/v1/me/room-invitations')
      .set(auth(bob))
      .expect(200);
    expect(mine.body.items[0]).toMatchObject({
      id: invitation.body.id,
      roomId: room.body.id,
      inviteeUserId: bob.id,
    });
    expect(JSON.stringify(mine.body)).not.toContain('passwordDigest');
    expect(JSON.stringify(mine.body)).not.toContain('participantIdentity');
    await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/memberships`)
      .set(auth(bob))
      .send({ rulesAccepted: true, password: '0000', invitationId: invitation.body.id })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/memberships`)
      .set(auth(bob))
      .send({ rulesAccepted: true, password: '1234', invitationId: invitation.body.id })
      .expect(201);
    expect(
      (await prisma.roomInvitation.findUniqueOrThrow({ where: { id: invitation.body.id } })).status,
    ).toBe('CONSUMED');
  });

  it('rejects non-host invitations and lets only the invitee decline', async () => {
    presence.onlineUsers.add(bob.id);
    const room = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(auth(alice))
      .send({ topic: 'Invitation permissions', cefrLevel: 'B1', capacity: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/invitations`)
      .set(auth(charlie))
      .send({ targetUserId: bob.id, clientRequestId: randomUUID() })
      .expect(403);
    const invitation = await request(app.getHttpServer())
      .post(`/v1/rooms/${room.body.id}/invitations`)
      .set(auth(alice))
      .send({ targetUserId: bob.id, clientRequestId: randomUUID() })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/room-invitations/${invitation.body.id}/decline`)
      .set(auth(charlie))
      .send({ clientRequestId: randomUUID() })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/v1/room-invitations/${invitation.body.id}/decline`)
      .set(auth(bob))
      .send({ clientRequestId: randomUUID() })
      .expect(200);
  });
});
