import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module.js';
import { configureApiApp } from '../../src/bootstrap/create-api-app.js';
import { AUTH_REPOSITORY, OAUTH_PROVIDER_REGISTRY } from '../../src/modules/auth/index.js';
import { PROFILE_REPOSITORY } from '../../src/modules/profiles/index.js';
import { installTestEnvironment, testEnvironment } from '../fixtures/environment.js';
import {
  FakeOAuthProviderRegistry,
  MemoryAuthRepository,
  MemoryProfileRepository,
} from '../fixtures/fakes.js';

interface LoginBody {
  userId: string;
  created: boolean;
  onboardingState: string;
  tokens: { accessToken: string; refreshToken: string };
  suggestedProfile: { displayName: string };
}

describe('identity-and-profile HTTP API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const browserConfig = {
      CORS_ALLOWED_ORIGINS: ['http://localhost:5173', 'http://localhost:8082'],
      GOOGLE_OAUTH_REDIRECT_URIS: 'slogan://oauth/google,http://localhost:8082',
    };
    installTestEnvironment(browserConfig);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(testEnvironment(browserConfig)))
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(new MemoryAuthRepository())
      .overrideProvider(PROFILE_REPOSITORY)
      .useValue(new MemoryProfileRepository())
      .overrideProvider(OAUTH_PROVIDER_REGISTRY)
      .useValue(new FakeOAuthProviderRegistry())
      .compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => app.close());

  async function login(code: string): Promise<LoginBody> {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/oauth/google/exchange')
      .send({ authorizationCode: code, redirectUri: 'slogan://oauth/google' })
      .expect(200);
    return response.body as LoginBody;
  }

  it('identity-and-profile / 首次和再次第三方登录：创建一次并返回资料初始化状态', async () => {
    const first = await login('same-google-subject');
    const second = await login('same-google-subject');
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.userId).toBe(first.userId);
    expect(first.onboardingState).toBe('PROFILE_REQUIRED');
    expect(first.suggestedProfile.displayName).toBe('Suggested only');

    const me = await request(app.getHttpServer())
      .get('/v1/me')
      .set('authorization', `Bearer ${first.tokens.accessToken}`)
      .expect(200);
    expect(me.body).toMatchObject({
      userId: first.userId,
      onboardingState: 'PROFILE_REQUIRED',
      profile: null,
    });
  });

  it('identity-and-profile / 资料完成和成年边界：服务端返回 AGE_RESTRICTED 或 ELIGIBLE', async () => {
    const loginResult = await login('profile-owner');
    const baseProfile = {
      avatarUrl: 'https://example.com/avatar.png',
      displayName: 'Profile Owner',
      genderCode: 'prefer_not_to_say',
      nationalityCode: 'CN',
      interestCodes: ['backend'],
      cefrLevel: 'B1_B2',
      birthMonth: 1,
    };
    const underage = await request(app.getHttpServer())
      .put('/v1/me/profile')
      .set('authorization', `Bearer ${loginResult.tokens.accessToken}`)
      .send({ ...baseProfile, birthYear: 2015 })
      .expect(200);
    expect(underage.body.onboardingState).toBe('AGE_RESTRICTED');

    const adult = await request(app.getHttpServer())
      .put('/v1/me/profile')
      .set('authorization', `Bearer ${loginResult.tokens.accessToken}`)
      .send({ ...baseProfile, birthYear: 2000 })
      .expect(200);
    expect(adult.body).toMatchObject({
      onboardingState: 'ELIGIBLE',
      profile: { birthYear: 2000, cefrLevel: 'B1_B2' },
    });
    const legacy = await request(app.getHttpServer())
      .put('/v1/me/profile')
      .set('authorization', `Bearer ${loginResult.tokens.accessToken}`)
      .send({ ...baseProfile, cefrLevel: 'B1', birthYear: 2000 })
      .expect(200);
    expect(legacy.body.profile.cefrLevel).toBe('B1');
  });

  it('rotates refresh tokens and revokes the session when an old token is reused', async () => {
    const loginResult = await login('refresh-owner');
    const refreshed = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: loginResult.tokens.refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: loginResult.tokens.refreshToken })
      .expect(401)
      .expect(({ body }) => expect(body.code).toBe('REFRESH_TOKEN_REUSED'));
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('authorization', `Bearer ${(refreshed.body as { accessToken: string }).accessToken}`)
      .expect(401);
  });

  it('restores and logs out a browser session using an HttpOnly rotating cookie', async () => {
    const browser = request.agent(app.getHttpServer());
    const origin = 'http://localhost:8082';
    const login = await browser
      .post('/v1/auth/web/google/exchange')
      .set('origin', origin)
      .send({ authorizationCode: 'browser-owner', redirectUri: origin });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ onboardingState: 'PROFILE_REQUIRED' });
    expect(login.body).not.toHaveProperty('refreshToken');
    expect(login.body).not.toHaveProperty('tokens');
    const loginCookie = String(login.headers['set-cookie']?.[0]);
    expect(loginCookie).toContain('HttpOnly');
    expect(loginCookie).toContain('SameSite=Lax');
    expect(loginCookie).toContain('Path=/v1/auth/web');
    expect(loginCookie).not.toContain('Expires=');

    const refreshed = await browser.post('/v1/auth/web/refresh').set('origin', origin).expect(200);
    expect(refreshed.body).toHaveProperty('accessToken');
    expect(refreshed.body).not.toHaveProperty('refreshToken');
    expect(String(refreshed.headers['set-cookie']?.[0])).toContain('HttpOnly');
    await browser
      .get('/v1/me')
      .set('authorization', `Bearer ${(refreshed.body as { accessToken: string }).accessToken}`)
      .expect(200);

    await browser.post('/v1/auth/web/logout').set('origin', origin).expect(204);
    await browser.post('/v1/auth/web/refresh').set('origin', origin).expect(401);
    await browser
      .get('/v1/me')
      .set('authorization', `Bearer ${(refreshed.body as { accessToken: string }).accessToken}`)
      .expect(401);
  });

  it('rejects browser cookie endpoints from unregistered origins', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/web/google/exchange')
      .send({ authorizationCode: 'browser-owner', redirectUri: 'http://localhost:8082' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/v1/auth/web/refresh')
      .set('origin', 'https://evil.example')
      .expect(400);
    await request(app.getHttpServer())
      .options('/v1/auth/web/refresh')
      .set('origin', 'http://localhost:8082')
      .set('access-control-request-method', 'POST')
      .expect(204)
      .expect('access-control-allow-credentials', 'true');
  });

  it('revokes the current session on logout', async () => {
    const loginResult = await login('logout-owner');
    await request(app.getHttpServer())
      .post('/v1/auth/logout')
      .set('authorization', `Bearer ${loginResult.tokens.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .get('/v1/me')
      .set('authorization', `Bearer ${loginResult.tokens.accessToken}`)
      .expect(401);
  });

  it.each([
    ['cancel', 400, 'AUTH_CODE_REJECTED'],
    ['unavailable', 503, 'AUTH_PROVIDER_UNAVAILABLE'],
    ['timeout', 504, 'AUTH_PROVIDER_TIMEOUT'],
  ])('maps provider failure %s to a stable response', async (code, status, errorCode) => {
    await request(app.getHttpServer())
      .post('/v1/auth/oauth/google/exchange')
      .send({ authorizationCode: code, redirectUri: 'slogan://oauth/google' })
      .expect(status)
      .expect(({ body }) => {
        expect(body.code).toBe(errorCode);
        expect(body).not.toHaveProperty('stack');
      });
  });

  it('rejects unauthenticated and malformed requests without leaking secrets', async () => {
    await request(app.getHttpServer()).get('/v1/me').expect(401);
    const response = await request(app.getHttpServer())
      .post('/v1/auth/oauth/google/exchange')
      .send({ authorizationCode: 'secret-code', redirectUri: 'not-a-uri', unexpected: true })
      .expect(400);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-request-id']).toBeDefined();
    expect(JSON.stringify(response.body)).not.toContain('secret-code');
    expect(response.body).not.toHaveProperty('stack');
  });
});
