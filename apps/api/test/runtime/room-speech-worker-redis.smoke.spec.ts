import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import type { Environment } from '../../src/config/environment.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import {
  SPEECH_TRANSCRIBER,
  type SpeechTranscriber,
} from '../../src/modules/assistance/contracts.js';
import { ROOM_MEDIA_SOURCE } from '../../src/modules/speech-safety/domain/ports/room-media-source.port.js';
import type {
  RoomMediaSource,
  RoomMediaFrame,
} from '../../src/modules/speech-safety/domain/ports/room-media-source.port.js';
import { RedisRoomSpeechCoordinator } from '../../src/modules/speech-safety/infrastructure/redis-room-speech-coordinator.js';
import { REALTIME_PROVIDER, type RealtimeProvider } from '../../src/modules/voice/index.js';
import { RoomSpeechWorkerModule } from '../../src/workers/room-speech/room-speech-worker.module.js';
import { RoomSpeechWorkerRunner } from '../../src/workers/room-speech/room-speech-worker.runner.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

class RuntimeMediaSource implements RoomMediaSource {
  readonly sessions = new Map<
    string,
    Parameters<RoomMediaSource['connect']>[0] & { closed: boolean }
  >();

  async healthCheck() {}

  async connect(input: Parameters<RoomMediaSource['connect']>[0]) {
    const state = { ...input, closed: false };
    this.sessions.set(input.roomId, state);
    return {
      close: async () => {
        state.closed = true;
      },
    };
  }

  emit(roomId: string, frame: RoomMediaFrame) {
    this.sessions.get(roomId)?.onFrame(frame);
  }
}

class RuntimeTranscriber implements SpeechTranscriber {
  readonly category = 'RUNTIME_STT';
  readonly audio: Uint8Array[] = [];
  async healthCheck() {}
  async deletionAssurance() {
    return { mode: 'NO_RETENTION' as const, result: 'COMPLETED' as const };
  }
  async transcribe(input: Parameters<SpeechTranscriber['transcribe']>[0]) {
    this.audio.push(input.audio);
    return { transcript: 'I will attack you', durationMs: 300, usageUnits: 1 };
  }
}

class RuntimeRealtime implements RealtimeProvider {
  readonly deliveries: Array<{ roomId: string; payload: Uint8Array; targets: string[] }> = [];
  ensureRoom = async () => 'runtime-room';
  updateRoomMetadata = async () => 'UPDATED' as const;
  token = async () => ({ token: 'runtime', expiresAt: new Date(Date.now() + 60_000) });
  participants = async () => ({ roomSid: 'runtime-room', participants: [] });
  revoke = async () => undefined;
  deleteRoom = async () => undefined;
  verifyWebhook = async () => null;
  async sendData(roomId: string, payload: Uint8Array, targets: string[]) {
    this.deliveries.push({ roomId, payload, targets });
  }
}

const logger = { warn: () => undefined } as unknown as StructuredLogger;

describe('room speech worker with real PostgreSQL and Redis', () => {
  const environment = testEnvironment({
    REALTIME_ENABLED: true,
    LIVEKIT_URL: 'wss://isolated-test.livekit.cloud',
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-livekit-secret-with-at-least-32-characters',
    REDIS_URL: 'redis://127.0.0.1:56379/11',
    ROOM_SPEECH_DETECTION_ENABLED: true,
    POST_ROOM_KEYWORDS_ENABLED: true,
    ROOM_SPEECH_HASH_SECRET: 'room-speech-runtime-secret-at-least-32-characters',
    ROOM_SPEECH_LEASE_SECONDS: 5,
    ROOM_SPEECH_WINDOW_MS: 250,
    ROOM_SPEECH_MAX_BUFFER_BYTES: 16_000,
    ROOM_SPEECH_MAX_ROOM_BUFFER_BYTES: 16_000,
    ROOM_SPEECH_SILENCE_MS: 100,
    STT_PROVIDER_CATEGORY: 'RUNTIME_STT',
    STT_BASE_URL: 'http://localhost:5555',
    STT_API_KEY: 'runtime-stt-key',
    STT_MODEL: 'runtime-stt',
    STT_REGION: 'local',
    STT_DATA_USE: 'REQUEST_PROCESSING_ONLY',
    STT_RETENTION_SECONDS: 0,
    STT_DELETION_MODE: 'NO_RETENTION',
    STT_STREAMING_MODE: 'SHORT_WINDOW',
  });

  let prisma: PrismaService;
  let roomId: string;
  let participantIdentity: string;
  let hostIdentity: string;

  beforeAll(async () => {
    installTestEnvironment(environment);
    const setup = await Test.createTestingModule({ imports: [RoomSpeechWorkerModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(environment))
      .overrideProvider(ROOM_MEDIA_SOURCE)
      .useValue(new RuntimeMediaSource())
      .overrideProvider(SPEECH_TRANSCRIBER)
      .useValue(new RuntimeTranscriber())
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(new RuntimeRealtime())
      .compile();
    prisma = setup.get(PrismaService);
    await clearRealtimeFixtures(prisma);
    const host = await seedAdult(prisma, 'Runtime speech host');
    const member = await seedAdult(prisma, 'Runtime speech member');
    roomId = randomUUID();
    const hostMembershipId = randomUUID();
    const memberMembershipId = randomUUID();
    participantIdentity = randomUUID();
    hostIdentity = randomUUID();
    const now = new Date();
    await prisma.room.create({
      data: {
        id: roomId,
        hostUserId: host.id,
        topic: 'Runtime room speech',
        cefrLevel: 'B1',
        capacity: 3,
        startedAt: now,
        endsAt: new Date(now.getTime() + 60_000),
        sensitiveSpeechDetectionEnabled: true,
        postRoomKeywordsEnabled: true,
        keywordSummary: {
          create: {
            topicSnapshot: 'Runtime room speech',
            extractorVersion: '2026-09-v1',
          },
        },
        memberships: {
          create: [
            {
              id: hostMembershipId,
              userId: host.id,
              role: 'HOST',
              joinOrder: 1,
              rulesVersion: '2026-09-v1',
              rulesAcceptedAt: now,
              joinedAt: now,
              participantIdentity: hostIdentity,
            },
            {
              id: memberMembershipId,
              userId: member.id,
              role: 'MEMBER',
              joinOrder: 2,
              rulesVersion: '2026-09-v1',
              rulesAcceptedAt: now,
              joinedAt: now,
              participantIdentity,
            },
          ],
        },
      },
    });
    await prisma.realtimeIdentity.createMany({
      data: [
        {
          identity: hostIdentity,
          roomId,
          membershipId: hostMembershipId,
          credentialVersion: 0,
          issueUntil: new Date(now.getTime() + 60_000),
        },
        {
          identity: participantIdentity,
          roomId,
          membershipId: memberMembershipId,
          credentialVersion: 0,
          issueUntil: new Date(now.getTime() + 60_000),
        },
      ],
    });
    await prisma.speechProcessingConsentEvent.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        clientRequestId: randomUUID(),
        purpose: 'ROOM_SAFETY_DETECTION',
        action: 'ACCEPT',
        noticeVersion: environment.ROOM_SPEECH_NOTICE_VERSION,
        providerCategory: 'RUNTIME_STT',
      },
    });
    await prisma.speechProcessingConsentEvent.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        clientRequestId: randomUUID(),
        purpose: 'POST_ROOM_KEYWORDS',
        action: 'ACCEPT',
        noticeVersion: environment.POST_ROOM_KEYWORDS_NOTICE_VERSION,
        providerCategory: 'RUNTIME_STT',
      },
    });
    await setup.close();
  });

  afterAll(async () => {
    const redis = new Redis(environment.REDIS_URL!);
    await redis.del(
      `post-room-keywords:${roomId}:counts`,
      `post-room-keywords:${roomId}:display`,
      `post-room-keywords:${roomId}:version`,
    );
    redis.disconnect();
    await clearRealtimeFixtures(prisma);
    await prisma.$disconnect();
  });

  async function startWorker() {
    const media = new RuntimeMediaSource();
    const stt = new RuntimeTranscriber();
    const realtime = new RuntimeRealtime();
    const ref = await Test.createTestingModule({ imports: [RoomSpeechWorkerModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService<Environment, true>(environment))
      .overrideProvider(ROOM_MEDIA_SOURCE)
      .useValue(media)
      .overrideProvider(SPEECH_TRANSCRIBER)
      .useValue(stt)
      .overrideProvider(REALTIME_PROVIDER)
      .useValue(realtime)
      .compile();
    await ref.init();
    const runner = ref.get(RoomSpeechWorkerRunner);
    const deadline = Date.now() + 3000;
    while (!media.sessions.has(roomId) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 25));
    expect(runner.health()).toMatchObject({ live: true, ready: true, activeRooms: 1 });
    return { ref, runner, media, stt, realtime };
  }

  it('fences duplicate workers, clears content on shutdown and recovers after restart', async () => {
    const first = await startWorker();
    const competitor = new RedisRoomSpeechCoordinator(
      new ConfigService<Environment, true>(environment),
      logger,
    );
    expect(await competitor.acquireRoom(roomId)).toBeNull();

    const silent = new Uint8Array(320);
    first.media.emit(roomId, { participantIdentity, audio: silent, mimeType: 'audio/pcm' });
    const oversizedA = new Uint8Array(16_002).fill(1);
    const oversizedB = new Uint8Array(16_002).fill(1);
    first.media.emit(roomId, {
      participantIdentity,
      audio: oversizedA,
      mimeType: 'audio/pcm',
    });
    first.media.emit(roomId, {
      participantIdentity,
      audio: oversizedB,
      mimeType: 'audio/pcm',
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(first.stt.audio).toHaveLength(0);
    expect(silent).toEqual(new Uint8Array(silent.byteLength));
    expect(oversizedA).toEqual(new Uint8Array(oversizedA.byteLength));
    expect(oversizedB).toEqual(new Uint8Array(oversizedB.byteLength));
    expect(
      await prisma.safetyCapabilityIncident.findFirstOrThrow({
        where: { roomId, errorCategory: 'ROOM_BACKPRESSURE_DROP' },
      }),
    ).toMatchObject({ affectedWindows: 2 });

    const frame = new Uint8Array([1, 2, 3, 4]);
    first.media.emit(roomId, { participantIdentity, audio: frame, mimeType: 'audio/pcm' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await first.runner.reconcile();
    const deadline = Date.now() + 3000;
    while ((await prisma.roomSpeechRiskEvent.count()) === 0 && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 25));
    await prisma.room.update({
      where: { id: roomId },
      data: {
        hostUserId: (
          await prisma.roomMembership.findUniqueOrThrow({
            where: { participantIdentity },
            select: { userId: true },
          })
        ).userId,
      },
    });
    await first.runner.reconcile();
    expect(await prisma.roomSpeechRiskEvent.count()).toBe(1);
    expect(first.stt.audio).toHaveLength(1);
    const redis = new Redis(environment.REDIS_URL!);
    expect(await redis.hlen(`post-room-keywords:${roomId}:counts`)).toBeGreaterThan(1);
    redis.disconnect();
    expect(first.realtime.deliveries).toHaveLength(1);
    expect(first.realtime.deliveries[0]?.targets).toEqual([participantIdentity]);
    expect(first.realtime.deliveries[0]?.targets).not.toContain(hostIdentity);
    expect(await prisma.roomMembership.count({ where: { roomId } })).toBe(2);
    expect(frame).toEqual(new Uint8Array(frame.byteLength));
    expect(first.stt.audio[0]).toBeDefined();
    expect(first.stt.audio[0]).toEqual(new Uint8Array(first.stt.audio[0]!.byteLength));

    await first.ref.close();
    expect(first.media.sessions.get(roomId)?.closed).toBe(true);
    const replacementLease = await competitor.acquireRoom(roomId);
    expect(replacementLease).not.toBeNull();
    expect(await competitor.renewRoom(roomId, randomUUID())).toBe(false);
    await competitor.releaseRoom(roomId, randomUUID());
    expect(await competitor.acquireRoom(roomId)).toBeNull();
    await competitor.releaseRoom(roomId, replacementLease!.fencingToken);
    await competitor.onModuleDestroy();

    const restarted = await startWorker();
    expect(restarted.media.sessions.has(roomId)).toBe(true);
    await restarted.ref.close();
  }, 15_000);
});
