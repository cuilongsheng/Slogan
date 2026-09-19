import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import type { Environment } from '../../src/config/environment.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  ACCOUNT_LIFECYCLE_REPOSITORY,
  type AccountLifecycleRepository,
} from '../../src/modules/account-lifecycle/index.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { REALTIME_PROVIDER } from '../../src/modules/voice/index.js';
import { RealtimeRunner, VoiceService } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import {
  clearRealtimeFixtures,
  FakeRealtimeProvider,
  realtimeEnvironment,
  seedAdult,
} from '../fixtures/realtime.js';

describe('account deletion realtime recovery after process restart', () => {
  const environment = realtimeEnvironment();
  const provider = new FakeRealtimeProvider();
  let first: TestingModule;
  let second: TestingModule;
  let prisma: PrismaService;

  beforeAll(() => installTestEnvironment(environment));

  afterAll(async () => {
    if (prisma) await clearRealtimeFixtures(prisma);
    await first?.close();
    await second?.close();
  });

  async function module() {
    return Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(environment))
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(provider)
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
  }

  it('blocks database access first and completes a durable participant revoke after restart', async () => {
    first = await module();
    await first.init();
    prisma = first.get(PrismaService);
    await clearRealtimeFixtures(prisma);
    const rooms = first.get(RoomsService);
    const sessions = first.get(SessionService);
    const repository = first.get<AccountLifecycleRepository>(ACCOUNT_LIFECYCLE_REPOSITORY);
    const voice = first.get(VoiceService);
    const owner = await seedAdult(prisma, 'Deleted connected owner');
    const member = await seedAdult(prisma, 'Recovery successor');
    const room = await rooms.create(owner.id, {
      topic: 'Deletion recovery',
      cefrLevel: 'B1',
      capacity: 3,
    });
    await rooms.join(member.id, room.room.id, { rulesAccepted: true });
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId: room.room.id, userId: member.id } },
      data: { presence: 'CONNECTED' },
    });
    const membership = await prisma.roomMembership.findUniqueOrThrow({
      where: { roomId_userId: { roomId: room.room.id, userId: owner.id } },
    });
    await prisma.roomMembership.update({
      where: { id: membership.id },
      data: { presence: 'CONNECTED' },
    });
    await prisma.realtimeIdentity.create({
      data: {
        identity: membership.participantIdentity,
        roomId: room.room.id,
        membershipId: membership.id,
        credentialVersion: membership.credentialVersion,
        issueUntil: new Date(Date.now() + 300_000),
      },
    });
    const token = (await sessions.issue(owner.id)).accessToken;
    await repository.deleteAccount({
      userId: owner.id,
      clientRequestId: randomUUID(),
      payloadHash: 'a'.repeat(64),
      now: new Date(),
    });
    await expect(sessions.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_INVALID',
    });

    provider.fail = true;
    await voice.dispatchPending(room.room.id);
    expect(
      await prisma.realtimeCommand.count({
        where: { roomId: room.room.id, type: 'REVOKE_IDENTITY', status: 'PENDING' },
      }),
    ).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toMatchObject({
      status: 'DELETED',
    });
    await first.close();

    provider.fail = false;
    second = await module();
    await second.init();
    prisma = second.get(PrismaService);
    await prisma.realtimeCommand.updateMany({
      where: { roomId: room.room.id, status: 'PENDING' },
      data: { nextAttemptAt: new Date() },
    });
    await second.get(VoiceService).dispatchPending(room.room.id);
    expect(provider.revoked).toContain(membership.participantIdentity);
    expect(
      await prisma.realtimeCommand.count({
        where: { roomId: room.room.id, type: 'REVOKE_IDENTITY', status: 'COMPLETED' },
      }),
    ).toBe(1);
  });
});
