import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import request from 'supertest';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  AuthMailService,
  SessionService,
  OAUTH_PROVIDER_REGISTRY,
  SMS_PROVIDER,
  type SmsProvider,
} from '../../src/modules/auth/index.js';
import { EmailSecurityAdapter } from '../../src/modules/auth/testing.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { emailEnvironment, emailConfig } from '../fixtures/email-auth.js';
import { installTestEnvironment } from '../fixtures/environment.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import { clearRealtimeFixtures } from '../fixtures/realtime.js';
import { smtpFixture } from '../fixtures/smtp.js';

class CaptureSms implements SmsProvider {
  sent: Array<{ to: string; code: string }> = [];
  async send(input: { to: string; code: string }) {
    this.sent.push(input);
  }
}
describe('email authentication HTTP flow with local SMTP', () => {
  let app: INestApplication, prisma: PrismaService, sessions: SessionService, mail: AuthMailService;
  let smtp: Awaited<ReturnType<typeof smtpFixture>>;
  const redis = new Redis('redis://127.0.0.1:56379/9');
  const security = new EmailSecurityAdapter(emailConfig());
  const sms = new CaptureSms();
  const password = 'Original phrase 2026!';
  beforeAll(async () => {
    smtp = await smtpFixture();
    installTestEnvironment(
      emailEnvironment({
        CORS_ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:8082',
        GOOGLE_OAUTH_REDIRECT_URIS: 'http://localhost:8082',
        EMAIL_SMTP_PORT: smtp.port,
        REDIS_URL: 'redis://127.0.0.1:56379/9',
        ACCOUNT_LIFECYCLE_ENABLED: true,
        PHONE_AUTH_ENABLED: true,
        PHONE_IDENTITY_PEPPER: 'fixture-identity-pepper-32-characters-long',
        PHONE_OTP_CODE_PEPPER: 'fixture-code-pepper-32-characters-long',
        SMS_PROVIDER_CATEGORY: 'TEST',
        SMS_PROVIDER_BASE_URL: 'http://localhost:4999/send',
        SMS_PROVIDER_API_KEY: 'fixture',
        SMS_PROVIDER_SENDER: 'fixture',
        SMS_PROVIDER_TEMPLATE: 'fixture',
        SMS_SUPPORTED_REGIONS: 'CN',
        STT_DELETION_MODE: 'NO_RETENTION',
        STT_STREAMING_MODE: 'SHORT_WINDOW',
        BACKUP_ENVIRONMENT_ID: 'test',
        BACKUP_ENCRYPTION_KEY_ID: 'test',
        BACKUP_RETENTION_COUNT: 1,
        BACKUP_RPO_SECONDS: 60,
        BACKUP_RTO_SECONDS: 60,
      }),
    );
    const { AppModule } = await import('../../src/app.module.js');
    const { configureApiApp } = await import('../../src/bootstrap/create-api-app.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .overrideProvider(SMS_PROVIDER)
      .useValue(sms)
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    sessions = ref.get(SessionService);
    mail = ref.get(AuthMailService);
  });
  beforeEach(async () => {
    await clearRealtimeFixtures(prisma);
    await redis.flushdb();
    smtp.messages.length = 0;
    sms.sent.length = 0;
  });
  afterAll(async () => {
    if (prisma) await clearRealtimeFixtures(prisma);
    if (app) await app.close();
    await redis.flushdb();
    redis.disconnect();
    if (smtp) await smtp.close();
  });
  function post(path: string, body: object, token?: string) {
    const r = request(app.getHttpServer()).post('/v1/' + path);
    if (token) r.set('Authorization', 'Bearer ' + token);
    return r.send(body);
  }
  async function pendingToken(purpose: 'REGISTER' | 'LINK' | 'RESET_PASSWORD') {
    const row = await prisma.emailDelivery.findFirstOrThrow({
      where: { challenge: { purpose }, encryptedPayload: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    return security.decrypt(row.id, row.encryptedPayload!, row.keyId).token;
  }
  async function registerVerified() {
    await post('auth/email/registrations', {
      username: 'Fixture_User',
      email: 'fixture@example.test',
      password,
    }).expect(202);
    const token = await pendingToken('REGISTER');
    await post('auth/email/verifications/confirm', { token }).expect(200);
    return (
      await post('auth/password/exchange', { username: 'fixture_user', password }).expect(200)
    ).body as {
      userId: string;
      onboardingState: string;
      tokens: { accessToken: string; refreshToken: string };
    };
  }
  it('requires explicit POST verification and preserves profile and role boundaries', async () => {
    const registration = await post('auth/email/registrations', {
      username: 'Fixture_User',
      email: 'fixture@example.test',
      password,
    }).expect(202);
    expect(registration.body.tokens).toBeUndefined();
    expect(await prisma.user.count()).toBe(0);
    expect(
      (await post('auth/password/exchange', { username: 'fixture_user', password }).expect(403))
        .body.code,
    ).toBe('EMAIL_VERIFICATION_REQUIRED');
    const wrong = await post('auth/password/exchange', {
      username: 'fixture_user',
      password: 'wrong-password',
    }).expect(401);
    const unknown = await post('auth/password/exchange', {
      username: 'unknown_user',
      password: 'wrong-password',
    }).expect(401);
    expect(wrong.body.code).toBe(unknown.body.code);
    const token = await pendingToken('REGISTER');
    await request(app.getHttpServer())
      .get('/v1/auth/email/verifications/confirm')
      .query({ token })
      .expect(404);
    expect(await prisma.user.count()).toBe(0);
    await mail.tick();
    expect(smtp.messages.length).toBe(1);
    await post('auth/email/verifications/confirm', { token }).expect(200);
    await post('auth/email/verifications/confirm', { token }).expect(400);
    const login = await post('auth/password/exchange', {
      username: 'fixture_user',
      password,
    }).expect(200);
    expect(login.body.onboardingState).toBe('PROFILE_REQUIRED');
    await request(app.getHttpServer())
      .get('/v1/me/login-methods')
      .set('Authorization', 'Bearer ' + login.body.tokens.accessToken)
      .expect(200)
      .expect((r) =>
        expect(r.body.methods).toContainEqual(
          expect.objectContaining({ type: 'EMAIL_PASSWORD', mask: '•••@•••' }),
        ),
      );
    await request(app.getHttpServer())
      .get('/v1/backoffice/me')
      .set('Authorization', 'Bearer ' + login.body.tokens.accessToken)
      .expect(403);
  });
  it('uses an HttpOnly cookie for browser password login and rejects untrusted origins', async () => {
    await registerVerified();
    const origin = 'http://localhost:8082';
    const browser = request.agent(app.getHttpServer());
    await browser
      .post('/v1/auth/web/password/exchange')
      .set('origin', 'https://evil.example')
      .send({ username: 'fixture_user', password })
      .expect(400);
    const login = await browser
      .post('/v1/auth/web/password/exchange')
      .set('origin', origin)
      .send({ username: 'fixture_user', password })
      .expect(200);
    expect(login.body).not.toHaveProperty('tokens');
    expect(login.body).not.toHaveProperty('refreshToken');
    expect(String(login.headers['set-cookie']?.[0])).toContain('HttpOnly');
    expect(String(login.headers['set-cookie']?.[0])).toContain('SameSite=Lax');
    const refreshed = await browser.post('/v1/auth/web/refresh').set('origin', origin).expect(200);
    expect(refreshed.body).toHaveProperty('accessToken');
    expect(refreshed.body).not.toHaveProperty('refreshToken');
    await browser.post('/v1/auth/web/logout').set('origin', origin).expect(204);
    await browser.post('/v1/auth/web/refresh').set('origin', origin).expect(401);
  });
  it('returns identical recovery acceptance and reset revokes access/refresh and old password', async () => {
    const login = await registerVerified();
    const known = await post('auth/password/reset-requests', {
      email: 'fixture@example.test',
    }).expect(202);
    const token = await pendingToken('RESET_PASSWORD');
    const unknown = await post('auth/password/reset-requests', {
      email: 'unknown@example.test',
    }).expect(202);
    expect(known.body).toEqual(unknown.body);
    expect(
      await prisma.emailDelivery.count({ where: { challenge: { purpose: 'RESET_PASSWORD' } } }),
    ).toBe(1);
    await mail.tick();
    expect(smtp.messages).toHaveLength(1);
    await post('auth/password/resets', { token, password: 'Replacement phrase 2026!' }).expect(204);
    await post('auth/refresh', { refreshToken: login.tokens.refreshToken }).expect(401);
    await request(app.getHttpServer())
      .get('/v1/me/login-methods')
      .set('Authorization', 'Bearer ' + login.tokens.accessToken)
      .expect(401);
    await post('auth/password/exchange', { username: 'fixture_user', password }).expect(401);
    await post('auth/password/exchange', {
      username: 'fixture_user',
      password: 'Replacement phrase 2026!',
    }).expect(200);
    await post('auth/password/resets', { token, password: 'Another replacement 2026!' }).expect(
      400,
    );
  });
  it('binds only an owned OAuth identity and valid original session, preserving userId', async () => {
    const oauth = await post('auth/oauth/google/exchange', {
      authorizationCode: 'existing-google',
      redirectUri: 'slogan://oauth/google',
    }).expect(200);
    const access = oauth.body.tokens.accessToken as string,
      command = randomUUID();
    await post(
      'me/login-methods/email/proofs/oauth/google',
      {
        authorizationCode: 'other-google',
        redirectUri: 'slogan://oauth/google',
        clientRequestId: command,
      },
      access,
    ).expect(400);
    const proof = await post(
      'me/login-methods/email/proofs/oauth/google',
      {
        authorizationCode: 'existing-google',
        redirectUri: 'slogan://oauth/google',
        clientRequestId: command,
      },
      access,
    ).expect(200);
    const body = {
      username: 'linked_user',
      email: 'linked@example.test',
      password,
      proof: proof.body.proof,
      clientRequestId: command,
    };
    await post('me/login-methods/email/requests', body, access).expect(202);
    await post(
      'me/login-methods/email/requests',
      { ...body, email: 'changed@example.test' },
      access,
    ).expect(409);
    const token = await pendingToken('LINK');
    await post('auth/email/verifications/confirm', { token }).expect(400);
    await post('me/login-methods/email/confirm', { token }, access).expect(200);
    const login = await post('auth/password/exchange', {
      username: 'linked_user',
      password,
    }).expect(200);
    expect(login.body.userId).toBe(oauth.body.userId);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.oAuthIdentity.count()).toBe(1);
  });
  it('does not accept a link after revoking its original session', async () => {
    const oauth = await post('auth/oauth/google/exchange', {
      authorizationCode: 'existing-google',
      redirectUri: 'slogan://oauth/google',
    }).expect(200);
    const command = randomUUID(),
      access = oauth.body.tokens.accessToken as string;
    const proof = await post(
      'me/login-methods/email/proofs/oauth/google',
      {
        authorizationCode: 'existing-google',
        redirectUri: 'slogan://oauth/google',
        clientRequestId: command,
      },
      access,
    ).expect(200);
    await post(
      'me/login-methods/email/requests',
      {
        username: 'linked_user',
        email: 'linked@example.test',
        password,
        proof: proof.body.proof,
        clientRequestId: command,
      },
      access,
    ).expect(202);
    const token = await pendingToken('LINK');
    const replacement = await sessions.issue(oauth.body.userId);
    await post('auth/logout', {}, access).expect(204);
    await post('me/login-methods/email/confirm', { token }, replacement.accessToken).expect(400);
    expect(await prisma.emailCredential.count()).toBe(0);
  });
  it('password deletion requires confirmation and keeps occupied identities unusable', async () => {
    const login = await registerVerified(),
      command = randomUUID(),
      access = login.tokens.accessToken;
    await post(
      'me/account/deletion/proofs/password',
      { password: 'wrong-password', clientRequestId: command },
      access,
    ).expect(401);
    const proof = await post(
      'me/account/deletion/proofs/password',
      { password, clientRequestId: command },
      access,
    ).expect(200);
    await post(
      'me/account/deletion',
      { proof: proof.body.proof, clientRequestId: command, confirmation: 'no' },
      access,
    ).expect(400);
    await post(
      'me/account/deletion',
      { proof: proof.body.proof, clientRequestId: command, confirmation: 'DELETE MY ACCOUNT' },
      access,
    ).expect(200);
    expect(
      await prisma.emailCredential.findUniqueOrThrow({ where: { userId: login.userId } }),
    ).toMatchObject({ passwordHash: null });
    await post('auth/password/exchange', { username: 'fixture_user', password }).expect(401);
    await post('auth/email/registrations', {
      username: 'fixture_user',
      email: 'new@example.test',
      password,
    }).expect(409);
    await post('auth/password/reset-requests', { email: 'fixture@example.test' }).expect(202);
    expect(
      await prisma.emailDelivery.count({ where: { challenge: { purpose: 'RESET_PASSWORD' } } }),
    ).toBe(0);
  });
  it('does not accept untrusted redirect fields or forged proxy headers to bypass source quotas', async () => {
    await post('auth/email/registrations', {
      username: 'fixture_user',
      email: 'fixture@example.test',
      password,
      redirectUri: 'https://untrusted.example',
    }).expect(400);
    for (let i = 0; i < 20; i++)
      await request(app.getHttpServer())
        .post('/v1/auth/password/reset-requests')
        .set('X-Forwarded-For', `192.0.2.${i + 1}`)
        .send({ email: `unknown${i}@example.test` })
        .expect(202);
    await post('auth/password/reset-requests', { email: 'another@example.test' }).expect(429);
  });
  it('keeps age restrictions and hides non-ACTIVE account state from password and reset responses', async () => {
    const login = await registerVerified();
    await prisma.userProfile.create({
      data: {
        userId: login.userId,
        avatarUrl: 'https://example.test/avatar.png',
        displayName: 'Fixture',
        genderCode: 'UNDISCLOSED',
        interestCodes: [],
        cefrLevel: 'A1',
        birthYear: new Date().getUTCFullYear() - 10,
        birthMonth: 1,
        completedAt: new Date(),
      },
    });
    const underage = await post('auth/password/exchange', {
      username: 'fixture_user',
      password,
    }).expect(200);
    expect(underage.body.onboardingState).toBe('AGE_RESTRICTED');
    for (const status of ['DISABLED', 'DELETED'] as const) {
      await prisma.user.update({ where: { id: login.userId }, data: { status } });
      expect(
        (await post('auth/password/exchange', { username: 'fixture_user', password }).expect(401))
          .body.code,
      ).toBe('EMAIL_CREDENTIALS_INVALID');
      expect(
        (await post('auth/password/reset-requests', { email: 'fixture@example.test' }).expect(202))
          .body,
      ).toEqual({ accepted: true });
    }
    expect(
      await prisma.emailDelivery.count({ where: { challenge: { purpose: 'RESET_PASSWORD' } } }),
    ).toBe(0);
  });
  it('supports owned phone reauthentication for LINK_EMAIL without accepting another phone', async () => {
    const challenge = await post('auth/phone/challenges', {
      phone: '+8613800138000',
      deviceId: 'email-link-fixture',
    }).expect(200);
    const login = await post('auth/phone/exchange', {
      challengeId: challenge.body.challengeId,
      code: sms.sent.at(-1)!.code,
      clientRequestId: randomUUID(),
    }).expect(200);
    const access = login.body.tokens.accessToken as string,
      command = randomUUID();
    await post(
      'me/login-methods/email/proofs/phone/challenges',
      { phone: '+8613800138001', deviceId: 'email-link-fixture' },
      access,
    ).expect(401);
    const step = await post(
      'me/login-methods/email/proofs/phone/challenges',
      { phone: '+8613800138000', deviceId: 'email-link-fixture' },
      access,
    ).expect(200);
    const proof = await post(
      'me/login-methods/email/proofs/phone/confirm',
      { challengeId: step.body.challengeId, code: sms.sent.at(-1)!.code, clientRequestId: command },
      access,
    ).expect(200);
    await post(
      'me/login-methods/email/requests',
      {
        username: 'phone_linked',
        email: 'phone@example.test',
        password,
        proof: proof.body.proof,
        clientRequestId: command,
      },
      access,
    ).expect(202);
    await post(
      'me/login-methods/email/confirm',
      { token: await pendingToken('LINK') },
      access,
    ).expect(200);
    expect(
      (await post('auth/password/exchange', { username: 'phone_linked', password }).expect(200))
        .body.userId,
    ).toBe(login.body.userId);
    expect(await prisma.phoneIdentity.count()).toBe(1);
  });
  it('rejects binding an occupied identity or adding a second email credential without merging users', async () => {
    const owner = await registerVerified();
    const other = await post('auth/oauth/google/exchange', {
      authorizationCode: 'separate-google',
      redirectUri: 'slogan://oauth/google',
    }).expect(200);
    const command = randomUUID(),
      access = other.body.tokens.accessToken as string;
    const proof = await post(
      'me/login-methods/email/proofs/oauth/google',
      {
        authorizationCode: 'separate-google',
        redirectUri: 'slogan://oauth/google',
        clientRequestId: command,
      },
      access,
    ).expect(200);
    await post(
      'me/login-methods/email/requests',
      {
        username: 'other_name',
        email: 'fixture@example.test',
        password,
        proof: proof.body.proof,
        clientRequestId: command,
      },
      access,
    ).expect(409);
    await prisma.oAuthIdentity.create({
      data: {
        id: randomUUID(),
        provider: 'GOOGLE',
        issuer: 'https://accounts.google.com',
        subject: 'owner-google',
        userId: owner.userId,
      },
    });
    const ownerCommand = randomUUID();
    const ownerProof = await post(
      'me/login-methods/email/proofs/oauth/google',
      {
        authorizationCode: 'owner-google',
        redirectUri: 'slogan://oauth/google',
        clientRequestId: ownerCommand,
      },
      owner.tokens.accessToken,
    ).expect(200);
    await post(
      'me/login-methods/email/requests',
      {
        username: 'second_name',
        email: 'second@example.test',
        password,
        proof: ownerProof.body.proof,
        clientRequestId: ownerCommand,
      },
      owner.tokens.accessToken,
    ).expect(409);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.emailCredential.count()).toBe(1);
    expect((await prisma.emailCredential.findFirstOrThrow()).userId).toBe(owner.userId);
  });
});
