import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config/environment.js';
import { GoogleOAuthAdapter } from '../../src/infrastructure/oauth/google-oauth.adapter.js';
import { WechatOAuthAdapter } from '../../src/infrastructure/oauth/wechat-oauth.adapter.js';

function config(overrides: Partial<Environment> = {}): ConfigService<Environment, true> {
  return new ConfigService<Environment, true>({
    APP_NAME: 'slogan-api-test',
    APP_PORT: 3000,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://slogan:slogan@127.0.0.1:5432/slogan_test',
    CORS_ALLOWED_ORIGINS: ['http://localhost:5173'],
    JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters',
    JWT_ACCESS_TTL_SECONDS: 900,
    JWT_ISSUER: 'slogan-api-test',
    JWT_AUDIENCE: 'slogan-test-clients',
    REFRESH_TOKEN_PEPPER: 'test-refresh-pepper-with-at-least-32-characters',
    REFRESH_TOKEN_TTL_SECONDS: 2_592_000,
    AUTH_RATE_LIMIT_POINTS: 100,
    AUTH_RATE_LIMIT_DURATION_SECONDS: 60,
    OAUTH_HTTP_TIMEOUT_MS: 1000,
    GOOGLE_OAUTH_ENABLED: true,
    GOOGLE_OAUTH_CLIENT_ID: 'google-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
    GOOGLE_OAUTH_REDIRECT_URIS: 'slogan://oauth/google',
    WECHAT_OAUTH_ENABLED: true,
    WECHAT_OAUTH_CLIENT_ID: 'wechat-client',
    WECHAT_OAUTH_CLIENT_SECRET: 'wechat-secret',
    WECHAT_OAUTH_REDIRECT_URIS: 'slogan://oauth/wechat',
    ...overrides,
  });
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('OAuth provider adapters', () => {
  const originalFetch = global.fetch;
  let fetchCalls: Array<[string | URL | Request, RequestInit | undefined]>;
  let fetchResults: Array<Promise<Response>>;

  beforeEach(() => {
    fetchCalls = [];
    fetchResults = [];
    global.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push([input, init]);
      const result = fetchResults.shift();
      if (result === undefined) throw new Error('Unexpected fetch call');
      return result;
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('exchanges and validates a Google authorization code without trusting suggested profile data', async () => {
    fetchResults.push(
      Promise.resolve(jsonResponse({ id_token: 'provider-id-token' })),
      Promise.resolve(
        jsonResponse({
          iss: 'accounts.google.com',
          sub: 'google-subject',
          aud: 'google-client',
          exp: Math.floor(Date.now() / 1000) + 300,
          name: 'Suggested Name',
          picture: 'https://example.com/avatar.png',
        }),
      ),
    );
    const adapter = new GoogleOAuthAdapter(config());

    const identity = await adapter.exchange({
      authorizationCode: 'one-time-code',
      redirectUri: 'slogan://oauth/google',
      codeVerifier: 'pkce-verifier',
    });

    expect(identity).toEqual({
      provider: 'GOOGLE',
      issuer: 'https://accounts.google.com',
      subject: 'google-subject',
      suggestedProfile: {
        displayName: 'Suggested Name',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
    const tokenRequest = fetchCalls[0];
    expect(String(tokenRequest?.[0])).toBe('https://oauth2.googleapis.com/token');
    expect(tokenRequest?.[1]?.method).toBe('POST');
    expect(String(tokenRequest?.[1]?.body)).toContain('code=one-time-code');
    expect(String(tokenRequest?.[1]?.body)).toContain('code_verifier=pkce-verifier');
  });

  it.each([
    [{ iss: 'evil.example', sub: 'subject', aud: 'google-client', exp: 4_102_444_800 }, 'issuer'],
    [
      { iss: 'accounts.google.com', sub: 'subject', aud: 'other-client', exp: 4_102_444_800 },
      'audience',
    ],
    [{ iss: 'accounts.google.com', sub: 'subject', aud: 'google-client', exp: 1 }, 'expiry'],
  ])('rejects a Google token with an invalid %s claim set', async (claims) => {
    fetchResults.push(
      Promise.resolve(jsonResponse({ id_token: 'provider-id-token' })),
      Promise.resolve(jsonResponse(claims)),
    );

    await expect(
      new GoogleOAuthAdapter(config()).exchange({
        authorizationCode: 'one-time-code',
        redirectUri: 'slogan://oauth/google',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_CODE_REJECTED' });
  });

  it('maps provider timeout and transport failure to stable errors', async () => {
    fetchResults.push(Promise.reject(new DOMException('timed out', 'TimeoutError')));
    await expect(
      new GoogleOAuthAdapter(config()).exchange({
        authorizationCode: 'one-time-code',
        redirectUri: 'slogan://oauth/google',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_PROVIDER_TIMEOUT' });

    fetchResults.push(Promise.reject(new TypeError('network unavailable')));
    await expect(
      new GoogleOAuthAdapter(config()).exchange({
        authorizationCode: 'one-time-code',
        redirectUri: 'slogan://oauth/google',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_PROVIDER_UNAVAILABLE' });
  });

  it('maps provider HTTP failures without leaking provider response details', async () => {
    fetchResults.push(Promise.resolve(jsonResponse({ error: 'provider-internal-detail' }, 503)));

    await expect(
      new GoogleOAuthAdapter(config()).exchange({
        authorizationCode: 'one-time-code',
        redirectUri: 'slogan://oauth/google',
      }),
    ).rejects.toMatchObject({
      code: 'AUTH_PROVIDER_UNAVAILABLE',
      message: 'OAuth provider is unavailable',
    });
  });

  it('rejects unregistered redirects before sending credentials', async () => {
    await expect(
      new GoogleOAuthAdapter(config()).exchange({
        authorizationCode: 'secret-code',
        redirectUri: 'https://evil.example/callback',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_CODE_REJECTED' });
    expect(fetchCalls).toHaveLength(0);
  });

  it('maps WeChat unionid to a stable cross-app identity', async () => {
    fetchResults.push(
      Promise.resolve(
        jsonResponse({
          access_token: 'temporary-provider-token',
          openid: 'openid-1',
          unionid: 'union-1',
        }),
      ),
    );

    const identity = await new WechatOAuthAdapter(config()).exchange({
      authorizationCode: 'wechat-code',
      redirectUri: 'slogan://oauth/wechat',
    });

    expect(identity).toEqual({
      provider: 'WECHAT',
      issuer: 'https://open.weixin.qq.com/unionid',
      subject: 'union-1',
    });
    const requestUrl = new URL(String(fetchCalls[0]?.[0]));
    expect(requestUrl.searchParams.get('appid')).toBe('wechat-client');
    expect(requestUrl.searchParams.get('code')).toBe('wechat-code');
    expect(requestUrl.searchParams.get('grant_type')).toBe('authorization_code');
  });

  it('uses an application-scoped issuer for WeChat openid and rejects provider error bodies', async () => {
    fetchResults.push(Promise.resolve(jsonResponse({ openid: 'openid-1' })));
    await expect(
      new WechatOAuthAdapter(config()).exchange({
        authorizationCode: 'wechat-code',
        redirectUri: 'slogan://oauth/wechat',
      }),
    ).resolves.toEqual({
      provider: 'WECHAT',
      issuer: 'https://open.weixin.qq.com/app/wechat-client',
      subject: 'openid-1',
    });

    fetchResults.push(Promise.resolve(jsonResponse({ errcode: 40029, errmsg: 'invalid code' })));
    await expect(
      new WechatOAuthAdapter(config()).exchange({
        authorizationCode: 'invalid-code',
        redirectUri: 'slogan://oauth/wechat',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_CODE_REJECTED' });
  });
});
