import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';

import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  OAUTH_PROVIDER_REGISTRY,
  SessionService,
  SMS_PROVIDER,
  type SmsProvider,
} from '../../src/modules/auth/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import { clearRealtimeFixtures, seedAdult } from '../fixtures/realtime.js';

class FakeSmsProvider implements SmsProvider {
  readonly sent: Array<{ to: string; code: string }> = [];
  async send(input: { to: string; code: string }): Promise<void> {
    this.sent.push(input);
  }
}

describe('account access lifecycle HTTP contract', () => {
  const redisUrl = 'redis://127.0.0.1:56379/10';
  let app: INestApplication;
  let prisma: PrismaService;
  let sessions: SessionService;
  let redis: Redis;
  const sms = new FakeSmsProvider();

  beforeAll(async () => {
    installTestEnvironment({
      PHONE_AUTH_ENABLED: true,
      ACCOUNT_LIFECYCLE_ENABLED: true,
      REDIS_URL: redisUrl,
      PHONE_IDENTITY_PEPPER: 'test-phone-identity-pepper-with-at-least-32-characters',
      PHONE_OTP_CODE_PEPPER: 'test-phone-code-pepper-with-at-least-32-characters',
      PHONE_OTP_RATE_LIMIT_POINTS: 20,
      PHONE_OTP_GLOBAL_RATE_LIMIT_POINTS: 100,
      SMS_PROVIDER_CATEGORY: 'TEST_SMS',
      SMS_PROVIDER_BASE_URL: 'http://localhost:4999/send',
      SMS_PROVIDER_API_KEY: 'test-sms-key',
      SMS_PROVIDER_SENDER: 'Slogan',
      SMS_PROVIDER_TEMPLATE: 'login',
      SMS_SUPPORTED_REGIONS: 'CN,US',
    });
    redis = new Redis(redisUrl);
    await redis.flushdb();
    const { configureApiApp } = await import('../../src/bootstrap/create-api-app.js');
    const { AppModule } = await import('../../src/app.module.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    expect(ref.get(ConfigService).get('PHONE_AUTH_ENABLED')).toBe(true);
    expect(ref.get(ConfigService).get('REDIS_URL')).toBe(redisUrl);
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
  });

  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    await redis.flushdb();
    sms.sent.splice(0);
  });

  afterAll(async () => {
    await clearRealtimeFixtures(prisma);
    await app.close();
    await redis.flushdb();
    redis.disconnect();
  });

  it('registers with OTP, binds three login methods, deletes access and permits audited admin read', async () => {
    const phone = '+8613800138000';
    const challenge = await request(app.getHttpServer())
      .post('/v1/auth/phone/challenges')
      .send({ phone, deviceId: 'account-lifecycle-device' })
      .expect(200);
    expect(challenge.body).toEqual({
      challengeId: expect.any(String),
      expiresAt: expect.any(String),
      resendAt: expect.any(String),
    });
    expect(sms.sent).toHaveLength(1);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/phone/exchange')
      .send({
        challengeId: challenge.body.challengeId,
        code: sms.sent[0]!.code,
        clientRequestId: randomUUID(),
        deviceName: 'iPhone',
      })
      .expect(200);
    expect(login.body).toMatchObject({ created: true, onboardingState: 'PROFILE_REQUIRED' });
    const token = login.body.tokens.accessToken as string;
    const auth = { authorization: `Bearer ${token}` };

    for (const provider of ['google', 'wechat'] as const) {
      await request(app.getHttpServer())
        .post(`/v1/me/login-methods/oauth/${provider}/link`)
        .set(auth)
        .send({
          authorizationCode: `${provider}-subject`,
          redirectUri: `slogan://oauth/${provider}`,
        })
        .expect(200, { result: 'CREATED' });
    }
    const methods = await request(app.getHttpServer())
      .get('/v1/me/login-methods')
      .set(auth)
      .expect(200);
    expect(methods.body.methods.map((item: { type: string }) => item.type).sort()).toEqual([
      'GOOGLE',
      'PHONE',
      'WECHAT',
    ]);
    expect(JSON.stringify(methods.body)).not.toContain(phone);

    const clientRequestId = randomUUID();
    const stepUpChallenge = await request(app.getHttpServer())
      .post('/v1/me/account/deletion/proofs/phone/challenges')
      .set(auth)
      .send({ phone, deviceId: 'account-lifecycle-device' })
      .expect(200);
    const proof = await request(app.getHttpServer())
      .post('/v1/me/account/deletion/proofs/phone/confirm')
      .set(auth)
      .send({
        challengeId: stepUpChallenge.body.challengeId,
        code: sms.sent[1]!.code,
        clientRequestId,
      })
      .expect(200);
    const deletion = await request(app.getHttpServer())
      .post('/v1/me/account/deletion')
      .set(auth)
      .send({
        proof: proof.body.proof,
        confirmation: 'DELETE MY ACCOUNT',
        clientRequestId,
      })
      .expect(200);
    expect(deletion.body).toMatchObject({ userId: login.body.userId, status: 'DELETED' });
    await request(app.getHttpServer()).get('/v1/me/login-methods').set(auth).expect(401);
    await request(app.getHttpServer())
      .post('/v1/auth/oauth/google/exchange')
      .send({
        authorizationCode: 'google-subject',
        redirectUri: 'slogan://oauth/google',
      })
      .expect(401);

    const admin = await seedAdult(prisma, 'Admin');
    await prisma.backofficeRoleAssignment.create({
      data: { userId: admin.id, role: 'PLATFORM_ADMIN' },
    });
    const adminToken = (await sessions.issue(admin.id)).accessToken;
    const restricted = await request(app.getHttpServer())
      .get(`/v1/backoffice/accounts/${login.body.userId}/restricted-record`)
      .set({ authorization: `Bearer ${adminToken}` })
      .expect(200);
    expect(restricted.body).toMatchObject({ userId: login.body.userId, status: 'DELETED' });
    expect(JSON.stringify(restricted.body)).not.toContain('google-subject');
    expect(
      await prisma.backofficeAuditEvent.count({
        where: { action: 'ACCOUNT_RESTRICTED_RECORD_VIEWED', actorUserId: admin.id },
      }),
    ).toBe(1);
  });
});
