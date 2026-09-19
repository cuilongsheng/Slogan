import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import { AssistanceCoordinatorStore } from '../../src/infrastructure/redis/assistance-coordinator.service.js';
import {
  ASSISTANCE_COORDINATOR,
  ASSISTANCE_MAINTENANCE,
  AssistanceError,
  EXPRESSION_GENERATOR,
  SPEECH_TRANSCRIBER,
  type AssistanceCoordinator,
  type AssistanceMaintenance,
  type ExpressionGenerator,
  type SpeechTranscriber,
} from '../../src/modules/assistance/index.js';
import { AssistanceMaintenanceQueue } from '../../src/modules/assistance/testing.js';
import { SessionService } from '../../src/modules/auth/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { testEnvironment } from '../fixtures/environment.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

class HttpGenerator implements ExpressionGenerator {
  readonly category = 'FAKE_AI';
  unavailable = false;
  calls = 0;
  async generate() {
    this.calls += 1;
    if (this.unavailable)
      throw new AssistanceError(
        'ASSISTANCE_PROVIDER_UNAVAILABLE',
        'Expression provider is unavailable',
      );
    return {
      output: {
        primary: { text: 'Could you repeat that?', tone: 'POLITE' as const },
        alternatives: [],
        noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE' as const,
      },
      usageUnits: 12,
    };
  }
}

class HttpTranscriber implements SpeechTranscriber {
  readonly category = 'FAKE_STT';
  calls = 0;
  async healthCheck() {}
  async transcribe() {
    this.calls += 1;
    return { transcript: '请再说一次', durationMs: 1000, usageUnits: 1 };
  }
}

class HttpCoordinator implements AssistanceCoordinator {
  limited = false;
  async acquire() {
    if (this.limited)
      throw new AssistanceError('ASSISTANCE_RATE_LIMITED', 'Assistance rate limit exceeded', {
        retryAfterSeconds: 11,
      });
    return { release: async () => undefined };
  }
}

const maintenance: AssistanceMaintenance = { scheduleExpiry: async () => undefined };

describe('AI expression assistance HTTP contract', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let host: { id: string; token: string };
  let member: { id: string; token: string };
  let roomId: string;
  const generator = new HttpGenerator();
  const transcriber = new HttpTranscriber();
  const coordinator = new HttpCoordinator();
  const environment = testEnvironment({
    ASSISTANCE_ENABLED: true,
    ASSISTANCE_AUDIO_ENABLED: true,
    REDIS_URL: 'redis://127.0.0.1:56379/15',
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
    STT_STREAMING_MODE: 'SHORT_WINDOW',
    ROOM_SPEECH_DETECTION_ENABLED: true,
    POST_ROOM_KEYWORDS_ENABLED: true,
    ROOM_SPEECH_HASH_SECRET: 'room-speech-e2e-secret-at-least-32-characters',
  });

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] })
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
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    generator.unavailable = false;
    generator.calls = 0;
    transcriber.calls = 0;
    coordinator.limited = false;
    const hostUser = await seedAdult(prisma, 'Assistance HTTP host');
    const memberUser = await seedAdult(prisma, 'Assistance HTTP member');
    host = { id: hostUser.id, token: (await sessions.issue(hostUser.id)).accessToken };
    member = { id: memberUser.id, token: (await sessions.issue(memberUser.id)).accessToken };
    const room = await request(app.getHttpServer())
      .post('/v1/rooms')
      .set(auth(host))
      .send({ topic: 'Travel', cefrLevel: 'B1', capacity: 3 })
      .expect(201);
    roomId = room.body.id;
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/memberships`)
      .set(auth(member))
      .send({ rulesAccepted: true })
      .expect(201);
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
  });

  const auth = (user: { token: string }) => ({ authorization: `Bearer ${user.token}` });

  it('completes accept, audio, revoke and text flows without exposing private input', async () => {
    const initial = await request(app.getHttpServer())
      .get('/v1/me/speech-processing-consents')
      .set(auth(member))
      .expect(200);
    expect(initial.body.items[0]).toMatchObject({ status: 'REQUIRED', noticeVersion: null });
    expect(initial.body.items[1]).toMatchObject({
      purpose: 'ROOM_SAFETY_DETECTION',
      status: 'REQUIRED',
      noticeVersion: null,
    });
    expect(initial.body.items[2]).toMatchObject({
      purpose: 'POST_ROOM_KEYWORDS',
      status: 'REQUIRED',
      noticeVersion: null,
    });
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/post-room-keywords')
      .set(auth(member))
      .send({
        clientRequestId: randomUUID(),
        action: 'ACCEPT',
        noticeVersion: '2026-09-v1',
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ purpose: 'POST_ROOM_KEYWORDS', status: 'ACCEPTED' });
      });
    const roomConsentKey = randomUUID();
    const roomConsent = {
      clientRequestId: roomConsentKey,
      action: 'ACCEPT',
      noticeVersion: '2026-09-v1',
    };
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/room-safety')
      .set(auth(member))
      .send(roomConsent)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          purpose: 'ROOM_SAFETY_DETECTION',
          status: 'ACCEPTED',
        });
      });
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/room-safety')
      .set(auth(member))
      .send(roomConsent)
      .expect(200);
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/room-safety')
      .set(auth(member))
      .send({ ...roomConsent, action: 'REVOKE' })
      .expect(409);
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/ai-expression')
      .set(auth(member))
      .send({ clientRequestId: randomUUID(), action: 'ACCEPT', noticeVersion: '2026-09-v1' })
      .expect(200);
    const audio = await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/audio`)
      .set(auth(member))
      .field('clientRequestId', randomUUID())
      .field('noticeVersion', '2026-09-v1')
      .field('noticeConfirmed', 'true')
      .field('sourceLanguageCode', 'zh-CN')
      .attach('audio', Buffer.from([1, 2, 3]), { filename: 'sample.wav', contentType: 'audio/wav' })
      .expect(200);
    expect(audio.body).toMatchObject({
      primary: { text: 'Could you repeat that?', tone: 'POLITE' },
      noticeCode: 'AI_OUTPUT_MAY_BE_INACCURATE',
    });
    for (const privateValue of ['请再说一次', 'FAKE_AI', 'FAKE_STT', member.id, host.id])
      expect(JSON.stringify(audio.body)).not.toContain(privateValue);
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/ai-expression')
      .set(auth(member))
      .send({ clientRequestId: randomUUID(), action: 'REVOKE', noticeVersion: '2026-09-v1' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/audio`)
      .set(auth(member))
      .field('clientRequestId', randomUUID())
      .field('noticeVersion', '2026-09-v1')
      .field('noticeConfirmed', 'true')
      .attach('audio', Buffer.from([1]), { filename: 'sample.wav', contentType: 'audio/wav' })
      .expect(403);
    const text = await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/text`)
      .set(auth(member))
      .send({ clientRequestId: randomUUID(), text: '我没听懂' })
      .expect(200);
    expect(JSON.stringify(text.body)).not.toContain('我没听懂');
  });

  it('returns minimal room safety alerts only to the current host', async () => {
    await prisma.roomSpeechRiskEvent.create({
      data: {
        id: randomUUID(),
        roomId,
        subjectUserId: member.id,
        category: 'HARASSMENT_ABUSE',
        severity: 'MEDIUM',
        ruleSetVersion: 'rules-v1',
        correlationHash: 'b'.repeat(64),
        firstOccurredAt: new Date(),
        lastOccurredAt: new Date(),
      },
    });
    const page = await request(app.getHttpServer())
      .get('/v1/rooms/' + roomId + '/safety-alerts')
      .set(auth(host))
      .expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0]).toMatchObject({
      roomId,
      subjectUserId: member.id,
      category: 'HARASSMENT_ABUSE',
      noticeCode: 'REQUIRES_HUMAN_REVIEW',
    });
    expect(JSON.stringify(page.body)).not.toMatch(/transcript|audio/i);
    await request(app.getHttpServer())
      .get('/v1/rooms/' + roomId + '/safety-alerts')
      .set(auth(member))
      .expect(403);
  });

  it('rejects auth, forged context and malformed uploads before providers', async () => {
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/text`)
      .send({ clientRequestId: randomUUID(), text: 'hello' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/text`)
      .set(auth(member))
      .send({
        clientRequestId: randomUUID(),
        text: 'hello',
        topic: 'forged',
        cefrLevel: 'C2',
        userId: host.id,
      })
      .expect(400);
    await request(app.getHttpServer())
      .put('/v1/me/speech-processing-consents/ai-expression')
      .set(auth(member))
      .send({ clientRequestId: randomUUID(), action: 'ACCEPT', noticeVersion: '2026-09-v1' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/audio`)
      .set(auth(member))
      .field('clientRequestId', randomUUID())
      .field('noticeVersion', '2026-09-v1')
      .field('noticeConfirmed', 'true')
      .attach('audio', Buffer.from([1]), {
        filename: 'sample.bin',
        contentType: 'application/octet-stream',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/audio`)
      .set(auth(member))
      .field('clientRequestId', randomUUID())
      .field('noticeVersion', '2026-09-v1')
      .field('noticeConfirmed', 'true')
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/audio`)
      .set(auth(member))
      .field('clientRequestId', randomUUID())
      .field('noticeVersion', '2026-09-v1')
      .field('noticeConfirmed', 'true')
      .attach('audio', Buffer.from([1]), { filename: 'one.wav', contentType: 'audio/wav' })
      .attach('audio', Buffer.from([2]), { filename: 'two.wav', contentType: 'audio/wav' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/audio`)
      .set(auth(member))
      .field('clientRequestId', randomUUID())
      .field('noticeVersion', '2026-09-v1')
      .field('noticeConfirmed', 'true')
      .attach('audio', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'large.wav',
        contentType: 'audio/wav',
      })
      .expect(413);
    expect(generator.calls).toBe(0);
    expect(transcriber.calls).toBe(0);
  });

  it('returns stable 429 and 503 errors while the room stays open', async () => {
    coordinator.limited = true;
    const limited = await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/text`)
      .set(auth(member))
      .send({ clientRequestId: randomUUID(), text: 'hello' })
      .expect(429);
    expect(limited.headers['retry-after']).toBe('11');
    expect(limited.body.code).toBe('ASSISTANCE_RATE_LIMITED');
    coordinator.limited = false;
    generator.unavailable = true;
    const unavailable = await request(app.getHttpServer())
      .post(`/v1/rooms/${roomId}/expression-assistance/text`)
      .set(auth(member))
      .send({ clientRequestId: randomUUID(), text: 'hello' })
      .expect(503);
    expect(unavailable.body).toMatchObject({
      code: 'ASSISTANCE_PROVIDER_UNAVAILABLE',
      message: 'Expression provider is unavailable',
    });
    expect(JSON.stringify(unavailable.body)).not.toContain('fake-ai-key');
    expect((await prisma.room.findUniqueOrThrow({ where: { id: roomId } })).status).toBe('OPEN');
  });
});
