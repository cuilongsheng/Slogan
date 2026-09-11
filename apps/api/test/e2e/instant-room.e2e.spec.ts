import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { AUTH_REPOSITORY, OAUTH_PROVIDER_REGISTRY } from '../../src/modules/auth/index.js';
import { PROFILE_REPOSITORY } from '../../src/modules/profiles/index.js';
import { ROOM_REPOSITORY } from '../../src/modules/rooms/index.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  FakeOAuthProviderRegistry,
  MemoryAuthRepository,
  MemoryProfileRepository,
  MemoryRoomRepository,
} from '../fixtures/fakes.js';

interface LoginBody {
  tokens: { accessToken: string };
}

interface RoomBody {
  id: string;
  memberCount: number;
  passwordProtected: boolean;
  startedAt: string;
  endsAt: string;
  currentMembership: { id: string; role: string; joinOrder: number } | null;
}

describe('instant room HTTP API', () => {
  let app: INestApplication;
  const rooms = new MemoryRoomRepository();

  beforeAll(async () => {
    installTestEnvironment();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(new MemoryAuthRepository())
      .overrideProvider(PROFILE_REPOSITORY)
      .useValue(new MemoryProfileRepository())
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .overrideProvider(ROOM_REPOSITORY)
      .useValue(rooms)
      .compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  beforeEach(() => rooms.clear());
  afterAll(async () => app.close());

  async function login(subject: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/oauth/google/exchange')
      .send({ authorizationCode: subject, redirectUri: 'slogan://oauth/google' })
      .expect(200);
    return (response.body as LoginBody).tokens.accessToken;
  }

  async function completeProfile(
    accessToken: string,
    displayName: string,
    birthYear = 2000,
  ): Promise<void> {
    await request(app.getHttpServer())
      .put('/v1/me/profile')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        avatarUrl: 'https://example.com/avatar.png',
        displayName,
        genderCode: 'prefer_not_to_say',
        nationalityCode: 'CN',
        interestCodes: ['backend'],
        cefrLevel: 'B1',
        birthYear,
        birthMonth: 1,
      })
      .expect(200);
  }

  async function adult(subject: string): Promise<string> {
    const token = await login(subject);
    await completeProfile(token, subject);
    return token;
  }

  async function createRoom(
    accessToken: string,
    input: Record<string, unknown> = {},
  ): Promise<RoomBody> {
    const response = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${accessToken}`)
      .send({ topic: 'Backend practice', cefrLevel: 'B1', capacity: 4, ...input })
      .expect(201);
    return response.body as RoomBody;
  }

  it('requires authentication and current adult profile eligibility on room APIs', async () => {
    await request(app.getHttpServer()).get('/v1/rooms').expect(401);

    const incomplete = await login('incomplete-room-user');
    await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${incomplete}`)
      .send({ topic: 'English practice', cefrLevel: 'B1', capacity: 4 })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('PROFILE_REQUIRED'));

    const underage = await login('underage-room-user');
    await completeProfile(underage, 'Underage User', new Date().getUTCFullYear() - 10);
    await request(app.getHttpServer())
      .get('/v1/rooms')
      .set('authorization', `Bearer ${underage}`)
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('AGE_RESTRICTED'));
  });

  it('creates public/password rooms with a host membership and lists them by cursor', async () => {
    const host = await adult('room-list-host');
    const first = await createRoom(host);
    const second = await createRoom(host, { topic: 'Password room', password: '1234' });

    expect(first).toMatchObject({
      memberCount: 1,
      passwordProtected: false,
      currentMembership: { role: 'HOST', joinOrder: 1 },
    });
    expect(second.passwordProtected).toBe(true);
    expect(new Date(first.endsAt).getTime() - new Date(first.startedAt).getTime()).toBe(7_200_000);
    expect(JSON.stringify(second)).not.toContain('1234');
    expect(second).not.toHaveProperty('passwordDigest');

    const firstPage = await request(app.getHttpServer())
      .get('/v1/rooms?limit=1')
      .set('authorization', `Bearer ${host}`)
      .expect(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.nextCursor).toEqual(expect.any(String));
    expect(firstPage.body.items[0].hostDisplayName).toEqual(expect.any(String));

    const secondPage = await request(app.getHttpServer())
      .get(`/v1/rooms?limit=1&cursor=${encodeURIComponent(firstPage.body.nextCursor as string)}`)
      .set('authorization', `Bearer ${host}`)
      .expect(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);
  });

  it('enforces rules, password, capacity, idempotency, expiry and stable errors', async () => {
    const host = await adult('room-join-host');
    const memberOne = await adult('room-member-one');
    const memberTwo = await adult('room-member-two');
    const publicRoom = await createRoom(host, { capacity: 2 });

    await request(app.getHttpServer())
      .post(`/v1/rooms/${publicRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberOne}`)
      .send({ rulesAccepted: false })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('ROOM_RULES_NOT_ACCEPTED'));

    const joined = await request(app.getHttpServer())
      .post(`/v1/rooms/${publicRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberOne}`)
      .send({ rulesAccepted: true })
      .expect(201);
    expect(joined.body).toMatchObject({
      memberCount: 2,
      currentMembership: { role: 'MEMBER', joinOrder: 2 },
    });

    const repeated = await request(app.getHttpServer())
      .post(`/v1/rooms/${publicRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberOne}`)
      .send({ rulesAccepted: false })
      .expect(201);
    expect(repeated.body.currentMembership.id).toBe(joined.body.currentMembership.id);
    expect(repeated.body.memberCount).toBe(2);

    await request(app.getHttpServer())
      .post(`/v1/rooms/${publicRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberTwo}`)
      .send({ rulesAccepted: true })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ROOM_FULL'));

    const passwordRoom = await createRoom(host, { password: '2468' });
    await request(app.getHttpServer())
      .post(`/v1/rooms/${passwordRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberTwo}`)
      .send({ rulesAccepted: true })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ROOM_PASSWORD_REQUIRED'));
    await request(app.getHttpServer())
      .post(`/v1/rooms/${passwordRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberTwo}`)
      .send({ rulesAccepted: true, password: '0000' })
      .expect(403)
      .expect(({ body }) => expect(body.code).toBe('ROOM_PASSWORD_INVALID'));
    await request(app.getHttpServer())
      .post(`/v1/rooms/${passwordRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberTwo}`)
      .send({ rulesAccepted: true, password: '2468' })
      .expect(201);

    rooms.expire(passwordRoom.id);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${passwordRoom.id}/memberships`)
      .set('authorization', `Bearer ${memberTwo}`)
      .send({ rulesAccepted: true, password: '2468' })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ROOM_ENDED'));
    await request(app.getHttpServer())
      .get(`/v1/rooms/${passwordRoom.id}`)
      .set('authorization', `Bearer ${host}`)
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('ROOM_ENDED'));

    await request(app.getHttpServer())
      .get('/v1/rooms/9e6db035-08ab-449f-8a7c-d7589a0bfe92')
      .set('authorization', `Bearer ${host}`)
      .expect(404)
      .expect(({ body }) => expect(body.code).toBe('ROOM_NOT_FOUND'));
  });

  it('rejects malformed room DTOs and opaque cursors without leaking submitted PINs', async () => {
    const host = await adult('room-validation-host');
    const response = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set('authorization', `Bearer ${host}`)
      .send({ topic: 'x', cefrLevel: 'Z9', capacity: 7, password: 'secret-pin' })
      .expect(400);
    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(response.body)).not.toContain('secret-pin');

    await request(app.getHttpServer())
      .get('/v1/rooms?cursor=not-an-opaque-cursor')
      .set('authorization', `Bearer ${host}`)
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe('VALIDATION_FAILED'));
  });
});
