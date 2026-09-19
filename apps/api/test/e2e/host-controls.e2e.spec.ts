import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RoomsService, RoomRealtimeService } from '../../src/modules/rooms/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  realtimeEnvironment,
  FakeRealtimeProvider,
  seedAdult,
  clearRealtimeFixtures,
} from '../fixtures/realtime.js';

describe('host controls HTTP contract', () => {
  let app: INestApplication,
    prisma: PrismaService,
    sessions: SessionService,
    rooms: RoomsService,
    realtime: RoomRealtimeService;
  let roomId: string,
    hostId: string,
    memberId: string,
    hostToken: string,
    memberToken: string,
    membershipId: string;
  const provider = new FakeRealtimeProvider();
  beforeAll(async () => {
    installTestEnvironment(realtimeEnvironment());
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(realtimeEnvironment()))
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(provider)
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    rooms = ref.get(RoomsService);
    realtime = ref.get(RoomRealtimeService);
    sessions = ref.get(SessionService);
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    provider.fail = false;
    provider.revoked = [];
    provider.deleted = [];
    hostId = (await seedAdult(prisma, 'Host')).id;
    memberId = (await seedAdult(prisma, 'Member')).id;
    hostToken = (await sessions.issue(hostId)).accessToken;
    memberToken = (await sessions.issue(memberId)).accessToken;
    roomId = (await rooms.create(hostId, { topic: 'Host HTTP', cefrLevel: 'B1', capacity: 3 })).room
      .id;
    membershipId = (await rooms.join(memberId, roomId, { rulesAccepted: true })).currentMembership!
      .id;
  });
  afterAll(async () => {
    await app.close();
    installTestEnvironment();
  });
  const post = (path: string, token = hostToken, body = {}) =>
    request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/${path}`)
      .set('authorization', `Bearer ${token}`)
      .send(body);
  it('requires Bearer authentication and validates generation and target identifiers', async () => {
    for (const path of [
      'leave',
      'end',
      `members/${membershipId}/removals`,
      `members/${membershipId}/invitations`,
    ])
      await request(app.getHttpServer()).post(`/v1/rooms/${roomId}/${path}`).send({}).expect(401);
    await post(`members/${membershipId}/removals`).expect(400);
    await post('members/bad-id/removals', hostToken, { expectedCredentialVersion: 0 }).expect(400);
    await post(`members/${membershipId}/removals`, memberToken, {
      expectedCredentialVersion: 0,
    }).expect(403);
    await post(`members/${randomUUID()}/removals`, hostToken, {
      expectedCredentialVersion: 0,
    }).expect(403);
  });
  it('leaves idempotently and rejoins at the end with a new credential generation', async () => {
    const first = await post('leave', memberToken, { expectedCredentialVersion: 0 }).expect(200);
    expect(first.body).toMatchObject({ lifecycle: 'LEFT', providerStatus: 'COMPLETED' });
    await post('leave', memberToken, { expectedCredentialVersion: 0 }).expect(200);
    const rejoin = await post('memberships', memberToken, { rulesAccepted: true }).expect(201);
    expect(rejoin.body.currentMembership).toMatchObject({
      lifecycle: 'ACTIVE',
      credentialVersion: 2,
      joinOrder: 3,
    });
    await post('leave', memberToken, { expectedCredentialVersion: 0 }).expect(409);
  });
  it('removes and reinvites while denying old grants and rechecking rules', async () => {
    const old = await post('realtime-credentials', memberToken).expect(200);
    await post(`members/${membershipId}/removals`, hostToken, {
      expectedCredentialVersion: 0,
    }).expect(200);
    await post('realtime-credentials', memberToken).expect(403);
    expect(
      (await post('memberships', memberToken, { rulesAccepted: true }).expect(403)).body.code,
    ).toBe('ROOM_INVITATION_REQUIRED');
    await post(`members/${membershipId}/invitations`, hostToken, {
      expectedCredentialVersion: 1,
    }).expect(200);
    await post('memberships', memberToken, { rulesAccepted: false }).expect(400);
    await post('memberships', memberToken, { rulesAccepted: true }).expect(201);
    const fresh = await post('realtime-credentials', memberToken).expect(200);
    expect(fresh.body.participantIdentity).not.toBe(old.body.participantIdentity);
    await post(`members/${membershipId}/removals`, hostToken, {
      expectedCredentialVersion: 0,
    }).expect(409);
  });
  it('rejects offline successor without fallback and revokes the old host authority after transfer', async () => {
    expect(
      (
        await post('leave', hostToken, {
          expectedCredentialVersion: 0,
          successorMembershipId: membershipId,
        }).expect(400)
      ).body.code,
    ).toBe('ROOM_SUCCESSOR_INVALID');
    await prisma.roomMembership.update({
      where: { id: membershipId },
      data: { presence: 'CONNECTED' },
    });
    const moved = await post('leave', hostToken, {
      expectedCredentialVersion: 0,
      successorMembershipId: membershipId,
    }).expect(200);
    expect(moved.body.hostUserId).toBe(memberId);
    await post('end', hostToken).expect(403);
    await post('end', memberToken).expect(200);
  });
  it('ends with no online successor and cannot restore room membership or credentials', async () => {
    const ended = await post('leave', hostToken, { expectedCredentialVersion: 0 }).expect(200);
    expect(ended.body.roomStatus).toBe('ENDED');
    await post('memberships', memberToken, { rulesAccepted: true }).expect(409);
    await post('realtime-credentials', memberToken).expect(409);
  });
  it('returns committed operation details when provider cleanup fails and supports end retries', async () => {
    await post('realtime-credentials', memberToken).expect(200);
    provider.fail = true;
    const failed = await post('end').expect(503);
    expect(failed.body).toMatchObject({
      code: 'REALTIME_PROVIDER_UNAVAILABLE',
      details: { roomStatus: 'ENDING', providerStatus: 'UNAVAILABLE' },
    });
    await post('realtime-credentials', memberToken).expect(409);
    provider.fail = false;
    await prisma.realtimeCommand.updateMany({ data: { nextAttemptAt: new Date(0) } });
    const recovered = await post('end').expect(200);
    expect(['ENDING', 'ENDED']).toContain(recovered.body.roomStatus);
    expect((await post('end').expect(200)).body.roomStatus).toBe('ENDED');
    await post('end').expect(200);
  });
  it('projects the reconnect window, allows existing recovery, and rejects new membership with retryAt', async () => {
    const token = await post('realtime-credentials').expect(200);
    await realtime.applySignal({
      id: randomUUID(),
      roomId,
      roomSid: 'RM_test',
      identity: token.body.participantIdentity,
      sessionSid: 'PA_host',
      type: 'left',
      occurredAt: new Date(),
    });
    const outsider = (await seedAdult(prisma)).id,
      outsiderToken = (await sessions.issue(outsider)).accessToken;
    const rejected = await post('memberships', outsiderToken, { rulesAccepted: true }).expect(409);
    expect(rejected.body.code).toBe('ROOM_HOST_RECONNECTING');
    expect(rejected.body.details.retryAt).toBeDefined();
    await post('memberships', memberToken, { rulesAccepted: false }).expect(201);
    await post('realtime-credentials', memberToken).expect(200);
    const members = await request(app.getHttpServer())
      .get(`/v1/rooms/${roomId}/members`)
      .set('authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(members.body).toHaveLength(2);
    expect(members.body[0]).toMatchObject({
      lifecycle: 'ACTIVE',
      credentialVersion: 0,
      hostReconnectDeadline: rejected.body.details.retryAt,
    });
    expect(members.body[0]).not.toHaveProperty('userId');
    expect(members.body[0]).not.toHaveProperty('providerSessionSid');
  });
});
