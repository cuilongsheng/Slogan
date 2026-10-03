import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AssistanceCoordinatorStore } from '../../src/infrastructure/redis/assistance-coordinator.service.js';
import {
  ASSISTANCE_COORDINATOR,
  ASSISTANCE_MAINTENANCE,
  AssistanceService,
  EXPRESSION_GENERATOR,
  SPEECH_TRANSCRIBER,
  type AssistanceCoordinator,
  type AssistanceMaintenance,
  type ExpressionGenerator,
  type SpeechTranscriber,
} from '../../src/modules/assistance/index.js';
import {
  AssistanceMaintenanceQueue,
  AssistancePolicy,
  PrismaAssistanceRepository,
} from '../../src/modules/assistance/testing.js';
import { RoomsService } from '../../src/modules/rooms/index.js';
import { testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

class FakeGenerator implements ExpressionGenerator {
  readonly category = 'FAKE_AI';
  readonly calls: Array<Parameters<ExpressionGenerator['generate']>[0]> = [];
  fail = false;
  async generate(input: Parameters<ExpressionGenerator['generate']>[0]) {
    this.calls.push(input);
    if (this.fail) throw new Error('synthetic provider failure');
    return {
      output: {
        primary: { text: 'Could you repeat that?', tone: 'POLITE' as const },
        alternatives: [{ text: 'Please say it again.', tone: 'NEUTRAL' as const }],
        noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE' as const,
      },
      usageUnits: 17,
    };
  }
}

class FakeTranscriber implements SpeechTranscriber {
  readonly category = 'FAKE_STT';
  readonly calls: Array<Parameters<SpeechTranscriber['transcribe']>[0]> = [];
  async healthCheck() {}
  async deletionAssurance() {
    return { mode: 'NO_RETENTION' as const, result: 'COMPLETED' as const };
  }
  fail = false;
  async transcribe(input: Parameters<SpeechTranscriber['transcribe']>[0]) {
    this.calls.push(input);
    if (this.fail) throw new Error('synthetic STT failure');
    return { transcript: '请再说一次', durationMs: 1250, usageUnits: 2 };
  }
}

class FakeCoordinator implements AssistanceCoordinator {
  acquisitions = 0;
  releases = 0;
  async acquire() {
    this.acquisitions += 1;
    return { release: async () => void (this.releases += 1) };
  }
}

class FakeMaintenance implements AssistanceMaintenance {
  readonly jobs: Array<{ requestId: string; expiresAt: Date }> = [];
  async scheduleExpiry(requestId: string, expiresAt: Date) {
    this.jobs.push({ requestId, expiresAt });
  }
}

describe('AI expression and temporary speech processing on PostgreSQL', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let assistance: AssistanceService;
  let repository: PrismaAssistanceRepository;
  let rooms: RoomsService;
  let userId: string;
  let otherId: string;
  let roomId: string;
  const generator = new FakeGenerator();
  const transcriber = new FakeTranscriber();
  const coordinator = new FakeCoordinator();
  const maintenance = new FakeMaintenance();
  const now = new Date('2026-09-16T10:00:00.000Z');
  const environment = testEnvironment({
    ASSISTANCE_ENABLED: true,
    ASSISTANCE_AUDIO_ENABLED: true,
    REDIS_URL: 'redis://127.0.0.1:56379/15',
    ASSISTANCE_USER_DAILY_REQUESTS: 2,
    AI_EXPRESSION_PROVIDER_CATEGORY: 'FAKE_AI',
    AI_EXPRESSION_BASE_URL: 'http://localhost:4444',
    AI_EXPRESSION_API_KEY: 'fake-ai-key',
    AI_EXPRESSION_MODEL: 'fake-expression',
    AI_EXPRESSION_REGION: 'local',
    AI_EXPRESSION_RETENTION_SECONDS: 0,
    AI_EXPRESSION_NO_TRAINING: true,
    STT_PROVIDER_CATEGORY: 'FAKE_STT',
    STT_BASE_URL: 'http://localhost:5555',
    STT_API_KEY: 'fake-stt-key',
    STT_MODEL: 'fake-stt',
    STT_REGION: 'local',
    STT_RETENTION_SECONDS: 0,
    STT_DELETION_MODE: 'NO_RETENTION',
    POST_ROOM_KEYWORDS_ENABLED: true,
  });

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(environment))
      .overrideProvider(EXPRESSION_GENERATOR)
      .useValue(generator)
      .overrideProvider(SPEECH_TRANSCRIBER)
      .useValue(transcriber)
      .overrideProvider(ASSISTANCE_COORDINATOR)
      .useValue(coordinator)
      .overrideProvider(AssistanceCoordinatorStore)
      .useValue(coordinator)
      .overrideProvider(ASSISTANCE_MAINTENANCE)
      .useValue(maintenance)
      .overrideProvider(AssistanceMaintenanceQueue)
      .useValue(maintenance)
      .compile();
    prisma = moduleRef.get(PrismaService);
    assistance = moduleRef.get(AssistanceService);
    repository = moduleRef.get(PrismaAssistanceRepository);
    rooms = moduleRef.get(RoomsService);
    await prisma.$connect();
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    generator.calls.length = 0;
    generator.fail = false;
    transcriber.calls.length = 0;
    transcriber.fail = false;
    maintenance.jobs.length = 0;
    userId = (await seedAdult(prisma, 'Assistance member')).id;
    otherId = (await seedAdult(prisma, 'Other member')).id;
    roomId = (await rooms.create(otherId, { topic: 'Travel', cefrLevel: 'B1', capacity: 3 }, now))
      .room.id;
    await rooms.join(userId, roomId, { rulesAccepted: true }, now);
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await moduleRef.close();
  });

  it('uses server context, stores no source text, replays success, and rejects changed input', async () => {
    const clientRequestId = randomUUID();
    const first = await assistance.text(
      userId,
      roomId,
      { clientRequestId, text: '  请再说一次  ' },
      now,
    );
    const replay = await assistance.text(
      userId,
      roomId,
      { clientRequestId, text: '请再说一次' },
      now,
    );
    expect(replay).toEqual(first);
    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]).toMatchObject({
      text: '请再说一次',
      topic: 'Travel',
      cefrLevel: 'B1',
    });
    const stored = await prisma.aiExpressionRequest.findUniqueOrThrow({
      where: { userId_clientRequestId: { userId, clientRequestId } },
    });
    expect(stored.inputDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain('请再说一次');
    expect(await prisma.aiUsageLedger.count({ where: { requestId: stored.id } })).toBe(1);
    expect(await prisma.roomEvent.count({ where: { roomId } })).toBe(0);
    expect(await prisma.roomNote.count({ where: { roomId } })).toBe(0);
    await expect(
      assistance.text(userId, roomId, { clientRequestId, text: '不同内容' }, now),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_REQUEST_CONFLICT' });
  });

  it('requires versioned consent, keeps transcript ephemeral, and revocation affects future audio only', async () => {
    const commandId = randomUUID();
    await expect(
      assistance.audio(
        userId,
        roomId,
        {
          clientRequestId: randomUUID(),
          noticeVersion: '2026-09-v1',
          noticeConfirmed: true,
          audio: new Uint8Array([1]),
          mimeType: 'audio/wav',
        },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_CONSENT_REQUIRED' });
    await assistance.changeConsent(
      userId,
      {
        clientRequestId: commandId,
        action: 'ACCEPT',
        noticeVersion: '2026-09-v1',
      },
      now,
    );
    await expect(
      assistance.changeConsent(
        userId,
        {
          clientRequestId: commandId,
          action: 'REVOKE',
          noticeVersion: '2026-09-v1',
        },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_REQUEST_CONFLICT' });
    const result = await assistance.audio(
      userId,
      roomId,
      {
        clientRequestId: randomUUID(),
        noticeVersion: '2026-09-v1',
        noticeConfirmed: true,
        sourceLanguageCode: 'zh-CN',
        audio: new Uint8Array([1, 2, 3]),
        mimeType: 'audio/wav',
      },
      now,
    );
    expect(result).not.toHaveProperty('transcript');
    expect(generator.calls[0]?.text).toBe('请再说一次');
    const databaseText = JSON.stringify(
      await prisma.aiExpressionRequest.findMany({ where: { userId } }),
    );
    expect(databaseText).not.toContain('请再说一次');
    await assistance.changeConsent(
      userId,
      {
        clientRequestId: randomUUID(),
        action: 'REVOKE',
        noticeVersion: '2026-09-v1',
      },
      now,
    );
    expect(await assistance.consentState(userId)).toMatchObject({ status: 'REVOKED' });
    await expect(
      assistance.audio(
        userId,
        roomId,
        {
          clientRequestId: randomUUID(),
          noticeVersion: '2026-09-v1',
          noticeConfirmed: true,
          audio: new Uint8Array([1]),
          mimeType: 'audio/wav',
        },
        now,
      ),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_CONSENT_REQUIRED' });
  });

  it('keeps post-room consent independent and revokes active processing access reliably', async () => {
    const keywordRoomId = randomUUID();
    const membershipId = randomUUID();
    const identity = randomUUID();
    await prisma.room.create({
      data: {
        id: keywordRoomId,
        hostUserId: otherId,
        topic: 'Keyword consent room',
        cefrLevel: 'B1',
        capacity: 3,
        status: 'OPEN',
        startedAt: now,
        endsAt: new Date(now.getTime() + 3_600_000),
        postRoomKeywordsEnabled: true,
        keywordSummary: {
          create: { topicSnapshot: 'Keyword consent room', extractorVersion: '2026-09-v1' },
        },
        memberships: {
          create: {
            id: membershipId,
            userId,
            role: 'MEMBER',
            joinOrder: 1,
            rulesVersion: 'v1',
            rulesAcceptedAt: now,
            joinedAt: now,
            participantIdentity: identity,
          },
        },
      },
    });
    await prisma.realtimeIdentity.create({
      data: {
        identity,
        roomId: keywordRoomId,
        membershipId,
        credentialVersion: 0,
        issueUntil: new Date(now.getTime() + 60_000),
      },
    });
    await assistance.changePostRoomKeywordsConsent(
      userId,
      { clientRequestId: randomUUID(), action: 'ACCEPT', noticeVersion: '2026-09-v1' },
      now,
    );
    expect(await assistance.postRoomKeywordsConsentState(userId)).toMatchObject({
      status: 'ACCEPTED',
    });
    expect(await assistance.roomConsentState(userId)).toMatchObject({ status: 'REQUIRED' });

    await assistance.changePostRoomKeywordsConsent(
      userId,
      { clientRequestId: randomUUID(), action: 'REVOKE', noticeVersion: '2026-09-v1' },
      new Date(now.getTime() + 1_000),
    );
    expect(
      await prisma.roomMembership.findUniqueOrThrow({ where: { id: membershipId } }),
    ).toMatchObject({
      lifecycle: 'LEFT',
      credentialVersion: 1,
    });
    expect(await prisma.realtimeIdentity.findUniqueOrThrow({ where: { identity } })).toMatchObject({
      revokedAt: expect.any(Date),
    });
    expect(
      await prisma.realtimeCommand.count({
        where: { roomId: keywordRoomId, type: 'REVOKE_IDENTITY' },
      }),
    ).toBe(1);
    expect(await prisma.roomSpeechRiskEvent.count({ where: { roomId: keywordRoomId } })).toBe(0);
    expect(await prisma.safetyCase.count()).toBe(0);
    expect(await prisma.safetyRestriction.count()).toBe(0);
  });

  it('enforces membership and room state before provider calls', async () => {
    await expect(
      assistance.text(otherId, randomUUID(), { clientRequestId: randomUUID(), text: 'hello' }, now),
    ).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' });
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lifecycle: 'LEFT', leftAt: now },
    });
    await expect(
      assistance.text(userId, roomId, { clientRequestId: randomUUID(), text: 'hello' }, now),
    ).rejects.toMatchObject({ code: 'ROOM_MEMBERSHIP_REQUIRED' });
    expect(generator.calls).toHaveLength(0);
  });

  it('rejects removed members, ended rooms and current safety restrictions', async () => {
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lifecycle: 'REMOVED', removedAt: now },
    });
    await expect(
      assistance.text(userId, roomId, { clientRequestId: randomUUID(), text: 'hello' }, now),
    ).rejects.toMatchObject({ code: 'ROOM_MEMBERSHIP_REQUIRED' });
    await prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lifecycle: 'ACTIVE', removedAt: null },
    });
    await prisma.room.update({ where: { id: roomId }, data: { status: 'ENDED', endedAt: now } });
    await expect(
      assistance.text(userId, roomId, { clientRequestId: randomUUID(), text: 'hello' }, now),
    ).rejects.toMatchObject({ code: 'ROOM_ENDED' });
    await prisma.room.update({ where: { id: roomId }, data: { status: 'OPEN', endedAt: null } });

    const reportId = randomUUID();
    const caseId = randomUUID();
    await prisma.report.create({
      data: {
        id: reportId,
        roomId,
        reporterUserId: otherId,
        targetUserId: userId,
        clientRequestId: randomUUID(),
        category: 'OTHER',
        description: 'assistance restriction fixture',
        submittedAt: now,
      },
    });
    await prisma.safetyCase.create({
      data: {
        id: caseId,
        reportId,
        roomId,
        targetUserId: userId,
        status: 'RESOLVED',
        assessedSeverity: 'GENERAL',
        decisionType: 'TEMPORARY_RESTRICTION',
        decisionReason: 'assistance restriction fixture',
        decidedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.safetyRestriction.create({
      data: {
        id: randomUUID(),
        caseId,
        userId,
        kind: 'TEMPORARY',
        severity: 'GENERAL',
        status: 'ACTIVE',
        reason: 'assistance restriction fixture',
        decidedByUserId: otherId,
        startsAt: new Date(now.getTime() - 1000),
        endsAt: new Date(now.getTime() + 3_600_000),
        appealDeadlineAt: new Date(now.getTime() + 1_800_000),
      },
    });
    await expect(
      assistance.text(userId, roomId, { clientRequestId: randomUUID(), text: 'hello' }, now),
    ).rejects.toMatchObject({ code: 'ROOM_ACCOUNT_RESTRICTED' });
    expect(generator.calls).toHaveLength(0);
  });

  it('uses lease tokens to reject late commits and invalidates purged output permanently', async () => {
    const policy = new AssistancePolicy();
    const clientRequestId = randomUUID();
    const reservation = await repository.reserve({
      userId,
      roomId,
      clientRequestId,
      mode: 'TEXT',
      digest: policy.digest({ roomId, mode: 'TEXT', value: 'hello' }),
      inputSize: 5,
      audioReservedSeconds: 0,
      now,
    });
    expect(reservation.kind).toBe('NEW');
    if (reservation.kind !== 'NEW') throw new Error('expected reservation');
    await prisma.aiExpressionRequest.update({
      where: { id: reservation.requestId },
      data: { leaseExpiresAt: new Date(now.getTime() - 1) },
    });
    const replacement = await repository.reserve({
      userId,
      roomId,
      clientRequestId,
      mode: 'TEXT',
      digest: policy.digest({ roomId, mode: 'TEXT', value: 'hello' }),
      inputSize: 5,
      audioReservedSeconds: 0,
      now,
    });
    expect(replacement).toMatchObject({ kind: 'NEW', requestId: reservation.requestId });
    await expect(
      repository.transition({
        requestId: reservation.requestId,
        leaseToken: reservation.leaseToken,
        from: ['RESERVED'],
        to: 'AI_RUNNING',
      }),
    ).rejects.toMatchObject({ code: 'ASSISTANCE_REQUEST_CONFLICT' });

    const result = await assistance.text(
      userId,
      roomId,
      {
        clientRequestId: randomUUID(),
        text: 'temporary',
      },
      now,
    );
    expect(
      await repository.purgeExpired(result.requestId, new Date(result.expiresAt.getTime() + 1)),
    ).toBe(1);
    expect(
      await repository.purgeExpired(result.requestId, new Date(result.expiresAt.getTime() + 2)),
    ).toBe(0);
    const expired = await prisma.aiExpressionRequest.findUniqueOrThrow({
      where: { id: result.requestId },
    });
    await expect(
      repository.reserve({
        userId,
        roomId,
        clientRequestId: expired.clientRequestId,
        mode: 'TEXT',
        digest: policy.digest({ roomId, mode: 'TEXT', value: 'temporary' }),
        inputSize: 9,
        audioReservedSeconds: 0,
        now: new Date(result.expiresAt.getTime() + 2),
      }),
    ).resolves.toEqual({ kind: 'EXPIRED' });
  });

  it('allows only the configured number of concurrent daily reservations', async () => {
    const policy = new AssistancePolicy();
    const inputs = Array.from({ length: 3 }, (_, index) => ({
      userId,
      roomId,
      clientRequestId: randomUUID(),
      mode: 'TEXT' as const,
      digest: policy.digest({ roomId, mode: 'TEXT' as const, value: `quota-${index}` }),
      inputSize: 7,
      audioReservedSeconds: 0,
      now,
    }));
    const outcomes = await Promise.allSettled(inputs.map((input) => repository.reserve(input)));
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(outcomes.filter((result) => result.status === 'rejected')[0]).toMatchObject({
      reason: { code: 'ASSISTANCE_QUOTA_EXCEEDED' },
    });
    expect(await prisma.aiUsageLedger.count({ where: { userId, kind: 'AI_EXPRESSION' } })).toBe(2);
  });
});
