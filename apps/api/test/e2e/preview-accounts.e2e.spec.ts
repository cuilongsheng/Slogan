import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  cleanupLocalPreviewAccounts,
  assertLocalCleanupTarget,
} from '../../src/scripts/local-preview-cleanup.js';
import { ACCOUNT_LIFECYCLE_REPOSITORY } from '../../src/modules/account-lifecycle/index.js';
import { PrismaEmailDeliveryRepository, MAIL_SENDER } from '../../src/modules/auth/testing.js';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Redis } from 'ioredis';
import { PrismaService } from '../../src/infrastructure/database/prisma.service.js';
import {
  PreviewAccountsService,
  EmailAuthService,
  SessionService,
  AuthMailService,
  PREVIEW_SLOTS,
  OAUTH_PROVIDER_REGISTRY,
  type PreviewAccountInput,
} from '../../src/modules/auth/index.js';
import { BackofficeBootstrapCommand } from '../../src/modules/backoffice/index.js';
import { RealtimeRunner } from '../../src/modules/voice/testing.js';
import { FakeOAuthProviderRegistry } from '../fixtures/fakes.js';
import { clearRealtimeFixtures } from '../fixtures/realtime.js';
import { emailEnvironment } from '../fixtures/email-auth.js';
import { installTestEnvironment } from '../fixtures/environment.js';

function fixture(): PreviewAccountInput[] {
  return PREVIEW_SLOTS.map((slot, index) => ({
    slot,
    username: 'preview_' + slot.toLowerCase(),
    password: `Isolated preview phrase ${index} !`,
    ...(slot.startsWith('MOBILE_')
      ? {
          profile: {
            avatarUrl: 'https://example.test/avatar.png',
            displayName: 'Preview ' + index,
            genderCode: 'prefer_not_to_say' as const,
            city: 'Test City',
            interestCodes: ['conversation'],
            cefrLevel: 'B1' as const,
            birthYear: 2000,
            birthMonth: 1,
          },
        }
      : {}),
  }));
}
describe('preview accounts: normal password sessions, real RBAC and mail-off boundary', () => {
  let app: INestApplication,
    prisma: PrismaService,
    preview: PreviewAccountsService,
    auth: EmailAuthService,
    sessions: SessionService,
    config: ConfigService;
  let sends = 0;
  const redis = new Redis('redis://127.0.0.1:56379/11');
  beforeAll(async () => {
    installTestEnvironment(
      emailEnvironment({
        EMAIL_AUTH_MAIL_ENABLED: false,
        PREVIEW_ACCOUNTS_ENABLED: true,
        PREVIEW_ENVIRONMENT_ID: 'isolated-preview',
        REDIS_URL: 'redis://127.0.0.1:56379/11',
        ACCOUNT_LIFECYCLE_ENABLED: true,
        GOOGLE_OAUTH_REDIRECT_URIS: 'http://localhost:5173',
        STT_DELETION_MODE: 'NO_RETENTION',
        STT_STREAMING_MODE: 'SHORT_WINDOW',
      }),
    );
    const { AppModule } = await import('../../src/app.module.js');
    const { configureApiApp } = await import('../../src/bootstrap/create-api-app.js');
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RealtimeRunner)
      .useValue({})
      .overrideProvider(MAIL_SENDER)
      .useValue({
        send: async () => {
          sends++;
          return 'SENT';
        },
      })
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .compile();
    app = ref.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = ref.get(PrismaService);
    preview = ref.get(PreviewAccountsService);
    auth = ref.get(EmailAuthService);
    sessions = ref.get(SessionService);
    config = ref.get(ConfigService);
  });
  beforeEach(async () => {
    sends = 0;
    config.set('EMAIL_AUTH_MAIL_ENABLED', false);
    config.set('PREVIEW_ACCOUNTS_ENABLED', true);
    config.set('PREVIEW_ENVIRONMENT_ID', 'isolated-preview');
    await clearRealtimeFixtures(prisma);
    await redis.flushdb();
  });
  afterAll(async () => {
    if (prisma) await clearRealtimeFixtures(prisma);
    if (app) await app.close();
    await redis.flushdb();
    redis.disconnect();
  });
  const post = (path: string, body: object, token?: string) => {
    const r = request(app.getHttpServer()).post('/v1/' + path);
    if (token) r.set('Authorization', 'Bearer ' + token);
    return r.send(body);
  };
  async function login(slot = 'MOBILE_A') {
    const input = fixture().find((a) => a.slot === slot)!;
    return auth.login(input, 'preview-test');
  }
  it('atomically creates only five identities, stays idempotent under concurrency and never overwrites profiles or passwords', async () => {
    const results = await Promise.all([
      preview.initialize('isolated-preview', fixture()),
      preview.initialize('isolated-preview', fixture()),
    ]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.user.count()).toBe(5);
    expect(await prisma.room.count()).toBe(0);
    expect(await prisma.authSession.count()).toBe(0);
    const credentials = await prisma.emailCredential.findMany();
    expect(new Set(credentials.map((c) => c.passwordHash)).size).toBe(5);
    expect(
      credentials.every((c) => c.verifiedAt === null && c.origin === 'PREVIEW_PROVISIONED'),
    ).toBe(true);
    const before = credentials.map((c) => c.passwordHash);
    await preview.initialize(
      'isolated-preview',
      fixture().map((a) => ({ ...a, password: a.password + ' altered' })),
    );
    expect((await prisma.emailCredential.findMany()).map((c) => c.passwordHash)).toEqual(before);
    for (const slot of ['MOBILE_A', 'MOBILE_B', 'MOBILE_C'])
      expect((await login(slot)).onboardingState).toBe('ELIGIBLE');
    expect(await prisma.emailDelivery.count()).toBe(0);
  });
  it('rejects malformed/adolescent profiles and conflicts without a partial batch; dry-run writes nothing', async () => {
    await preview.initialize('isolated-preview', fixture(), true);
    expect(await prisma.user.count()).toBe(0);
    const invalid = fixture();
    invalid[2]!.profile!.birthYear = new Date().getUTCFullYear();
    await expect(preview.initialize('isolated-preview', invalid)).rejects.toThrow();
    expect(await prisma.user.count()).toBe(0);
    await expect(preview.initialize('other', fixture())).rejects.toMatchObject({
      code: 'EMAIL_AUTH_UNAVAILABLE',
    });
  });
  it('returns truthful origins, enforces cookie/origin and refuses closed email endpoints without side effects', async () => {
    await preview.initialize('isolated-preview', fixture());
    const user = await login();
    const methods = await request(app.getHttpServer())
      .get('/v1/me/login-methods')
      .set('Authorization', 'Bearer ' + user.tokens.accessToken)
      .expect(200);
    expect(methods.body.methods).toEqual([
      { type: 'EMAIL_PASSWORD', origin: 'PREVIEW_PROVISIONED', verifiedAt: null },
    ]);
    for (const [path, body, authenticated] of [
      [
        'auth/email/registrations',
        { username: 'new_user', email: 'fixture@example.test', password: fixture()[0]!.password },
        false,
      ],
      ['auth/email/verifications/resend', { managementToken: 'A'.repeat(43) }, false],
      ['auth/email/verifications/confirm', { token: 'A'.repeat(43) }, false],
      ['auth/password/reset-requests', { email: 'fixture@example.test' }, false],
      ['auth/password/resets', { token: 'A'.repeat(43), password: fixture()[0]!.password }, false],
      [
        'me/login-methods/email/requests',
        {
          username: 'new_user',
          email: 'fixture@example.test',
          password: fixture()[0]!.password,
          proof: 'A'.repeat(43),
          clientRequestId: randomUUID(),
        },
        true,
      ],
      ['me/login-methods/email/confirm', { token: 'A'.repeat(43) }, true],
      [
        'me/login-methods/email/proofs/oauth/google',
        {
          authorizationCode: 'fixture',
          redirectUri: 'http://localhost:5173',
          clientRequestId: randomUUID(),
        },
        true,
      ],
    ] as const)
      expect(
        (await post(path, body, authenticated ? user.tokens.accessToken : undefined)).status,
      ).toBe(503);
    expect(await prisma.emailEnrollment.count()).toBe(0);
    expect(await prisma.emailChallenge.count()).toBe(0);
    expect(await prisma.emailDelivery.count()).toBe(0);
    const { username, password } = fixture()[2]!;
    const input = { username, password };
    const browser = await post('auth/web/password/exchange', input)
      .set('Origin', 'http://localhost:5173')
      .expect(200);
    expect(String(browser.headers['set-cookie'])).toContain('HttpOnly');
    expect(browser.body.refreshToken).toBeUndefined();
    await post('auth/web/password/exchange', input)
      .set('Origin', 'http://untrusted.example')
      .expect(400);
    const cap = await request(app.getHttpServer()).get('/v1/auth/capabilities').expect(200);
    expect(cap.body).toEqual({ password: true, google: false, email: false });
  });
  it('uses authenticated audit role commands, preserves distinct roles and rejects normal-user direct API access', async () => {
    const result = await preview.initialize('isolated-preview', fixture());
    const admin = result.accounts.find((a) => a.slot === 'ADMIN')!;
    const safety = result.accounts.find((a) => a.slot === 'SAFETY')!;
    await app.get(BackofficeBootstrapCommand).execute(admin.userId);
    const token = (await login('ADMIN')).tokens.accessToken;
    const grant = { clientRequestId: admin.grantCommandId, reason: 'Preview roles separation' };
    await post(`backoffice/users/${safety.userId}/roles/SAFETY_OFFICER/grant`, grant, token).expect(
      200,
    );
    await post(`backoffice/users/${safety.userId}/roles/SAFETY_OFFICER/grant`, grant, token).expect(
      200,
    );
    await post(
      `backoffice/users/${admin.userId}/roles/SAFETY_OFFICER/revoke`,
      { clientRequestId: admin.revokeCommandId, reason: 'Preview roles separation' },
      token,
    ).expect(200);
    await preview.completeRoles('isolated-preview');
    await preview.initialize('isolated-preview', fixture());
    const state = await preview.inspect('isolated-preview');
    expect(state.map((a) => a.roles)).toEqual([['PLATFORM_ADMIN'], ['SAFETY_OFFICER'], [], [], []]);
    const ordinary = await login();
    await request(app.getHttpServer())
      .get('/v1/backoffice/me')
      .set('Authorization', 'Bearer ' + ordinary.tokens.accessToken)
      .expect(403);
    const safetyToken = (await login('SAFETY')).tokens.accessToken;
    await post(
      `backoffice/users/${admin.userId}/roles/PLATFORM_ADMIN/revoke`,
      { clientRequestId: randomUUID(), reason: 'Denied' },
      safetyToken,
    ).expect(403);
    await post(
      `backoffice/users/${admin.userId}/roles/PLATFORM_ADMIN/revoke`,
      { clientRequestId: randomUUID(), reason: 'Last admin' },
      token,
    ).expect(409);
  });
  it('fails closed for missing mapping, disabled/cross-environment/retired accounts, including existing sessions', async () => {
    await preview.initialize('isolated-preview', fixture());
    const user = await login();
    config.set('PREVIEW_ACCOUNTS_ENABLED', false);
    await expect(login()).rejects.toMatchObject({ code: 'EMAIL_CREDENTIALS_INVALID' });
    await expect(sessions.verifyAccessToken(user.tokens.accessToken)).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_INVALID',
    });
    await expect(sessions.refresh(user.tokens.refreshToken)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_INVALID',
    });
    sends = 0;
    config.set('EMAIL_AUTH_MAIL_ENABLED', false);
    config.set('PREVIEW_ACCOUNTS_ENABLED', true);
    config.set('PREVIEW_ENVIRONMENT_ID', 'wrong');
    await expect(login()).rejects.toMatchObject({ code: 'EMAIL_CREDENTIALS_INVALID' });
    config.set('PREVIEW_ENVIRONMENT_ID', 'isolated-preview');
    await prisma.previewAccountProvisioning.delete({ where: { userId: user.userId } });
    await expect(login()).rejects.toMatchObject({ code: 'EMAIL_CREDENTIALS_INVALID' });
    await expect(sessions.verifyAccessToken(user.tokens.accessToken)).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_INVALID',
    });
  });
  it('cancels pending/running mail, fences late settlement and preserves valid account-deletion proofs with zero sends', async () => {
    await preview.initialize('isolated-preview', fixture());
    const user = await login();
    const proof = await post(
      'me/account/deletion/proofs/password',
      { password: fixture()[2]!.password, clientRequestId: randomUUID() },
      user.tokens.accessToken,
    ).expect(200);
    expect(proof.body.proof).toBeDefined();
    config.set('EMAIL_AUTH_MAIL_ENABLED', true);
    await auth.register(
      { username: 'pending_one', email: 'one@example.test', password: fixture()[0]!.password },
      'mail-test',
    );
    const repo = app.get(PrismaEmailDeliveryRepository);
    const claims = await repo.claim(new Date());
    expect(claims).toHaveLength(1);
    await auth.register(
      { username: 'pending_two', email: 'two@example.test', password: fixture()[1]!.password },
      'mail-test',
    );
    config.set('EMAIL_AUTH_MAIL_ENABLED', false);
    await app.get(AuthMailService).disablePending();
    await app.get(AuthMailService).disablePending();
    await repo.settle(claims[0]!.id, claims[0]!.generation, 'SENT', new Date());
    expect(await app.get(AuthMailService).tick()).toBe(0);
    expect(sends).toBe(0);
    expect(
      (await prisma.emailDelivery.findMany()).every(
        (d) => d.status === 'CANCELLED' && d.encryptedPayload === null,
      ),
    ).toBe(true);
    expect(
      (await prisma.emailEnrollment.findMany()).every(
        (e) => e.passwordHash === null && e.managementDigest === null,
      ),
    ).toBe(true);
    expect(
      await prisma.emailAuthProof.count({ where: { purpose: 'ACCOUNT_DELETE', consumedAt: null } }),
    ).toBe(1);
    config.set('EMAIL_AUTH_MAIL_ENABLED', true);
    expect(await app.get(AuthMailService).tick()).toBe(0);
    expect(sends).toBe(0);
  });
  it('restricts local rebuild to the confirmed development target and reuses lifecycle deletion while retaining history', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'slogan-preview-test-'));
    const backupPath = join(directory, 'backup.dump');
    await writeFile(backupPath, 'PGDMP' + 'isolated fixture'.repeat(20), { mode: 0o600 });
    const target = {
      databaseUrl: 'postgresql://fixture:fixture@127.0.0.1:5432/slogan',
      nodeEnvironment: 'development',
      environmentId: 'local-preview',
      backupPath,
    };
    try {
      for (const overrides of [
        { nodeEnvironment: 'production' },
        { environmentId: 'remote' },
        { databaseUrl: 'postgresql://fixture@remote.example:5432/slogan' },
        { databaseUrl: 'postgresql://fixture@127.0.0.1:54329/slogan_test' },
        { backupPath: undefined },
      ])
        await expect(assertLocalCleanupTarget({ ...target, ...overrides })).rejects.toThrow();
      const old = await prisma.user.create({ data: { id: randomUUID() } });
      await app.get(BackofficeBootstrapCommand).execute(old.id);
      // Isolated Prisma connection; target metadata exercises the same CLI guard without accessing development data.
      expect(
        await cleanupLocalPreviewAccounts(prisma, app.get(ACCOUNT_LIFECYCLE_REPOSITORY), target),
      ).toBe(1);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: old.id } })).status).toBe(
        'DELETED',
      );
      expect(await prisma.backofficeRoleAssignment.count({ where: { revokedAt: null } })).toBe(0);
      expect(await prisma.backofficeAuditEvent.count()).toBeGreaterThan(0);
      expect(
        await cleanupLocalPreviewAccounts(prisma, app.get(ACCOUNT_LIFECYCLE_REPOSITORY), target),
      ).toBe(0);
      await preview.initialize('isolated-preview', fixture());
      expect(await prisma.user.count({ where: { status: 'ACTIVE' } })).toBe(5);
    } finally {
      await rm(directory, { recursive: true });
    }
  });
  it('preserves existing admins on the explicit existing-admin path and retires a normal account through password proof', async () => {
    const existing = await prisma.user.create({ data: { id: randomUUID() } });
    await app.get(BackofficeBootstrapCommand).execute(existing.id);
    await expect(preview.initialize('isolated-preview', fixture())).rejects.toMatchObject({
      code: 'EMAIL_COMMAND_CONFLICT',
    });
    await preview.initialize('isolated-preview', fixture(), false, new Date(), true);
    expect(await prisma.user.count()).toBe(6);
    const user = await login();
    const clientRequestId = randomUUID();
    const proof = await post(
      'me/account/deletion/proofs/password',
      { password: fixture()[2]!.password, clientRequestId },
      user.tokens.accessToken,
    ).expect(200);
    await post(
      'me/account/deletion',
      { proof: proof.body.proof, clientRequestId, confirmation: 'DELETE MY ACCOUNT' },
      user.tokens.accessToken,
    ).expect(200);
    expect(
      (await prisma.emailCredential.findUniqueOrThrow({ where: { userId: user.userId } }))
        .passwordHash,
    ).toBeNull();
    expect(
      (
        await prisma.previewAccountProvisioning.findUniqueOrThrow({
          where: { userId: user.userId },
        })
      ).retiredAt,
    ).not.toBeNull();
    await expect(sessions.verifyAccessToken(user.tokens.accessToken)).rejects.toThrow();
    await expect(
      preview.initialize('isolated-preview', fixture(), false, new Date(), true),
    ).rejects.toThrow();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).status).toBe(
      'ACTIVE',
    );
  });
});
