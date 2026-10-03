import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { spyOn } from 'jest-mock';

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
  let verifyIdToken: jest.SpyInstance;

  function verifiedClaims(claims: Record<string, unknown>) {
    verifyIdToken.mockResolvedValue({ getPayload: () => claims });
  }

  beforeEach(() => {
    fetchCalls = [];
    fetchResults = [];
    verifyIdToken = spyOn(OAuth2Client.prototype, 'verifyIdToken');
    global.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push([input, init]);
      const result = fetchResults.shift();
      if (result === undefined) throw new Error('Unexpected fetch call');
      return result;
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    verifyIdToken.mockRestore();
  });

  it('exchanges and validates a Google authorization code without trusting suggested profile data', async () => {
    fetchResults.push(Promise.resolve(jsonResponse({ id_token: 'provider-id-token' })));
    verifiedClaims({
      iss: 'accounts.google.com',
      sub: 'google-subject',
      aud: 'google-client',
      exp: Math.floor(Date.now() / 1000) + 300,
      name: 'Suggested Name',
      picture: 'https://example.com/avatar.png',
    });
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
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'provider-id-token',
      audience: 'google-client',
    });
  });

  it('exchanges a native Google server authorization code with an empty provider redirect', async () => {
    fetchResults.push(Promise.resolve(jsonResponse({ id_token: 'provider-id-token' })));
    verifiedClaims({
      iss: 'accounts.google.com',
      sub: 'native-google-subject',
      aud: 'google-client',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const adapter = new GoogleOAuthAdapter(
      config({ GOOGLE_OAUTH_REDIRECT_URIS: 'slogan://oauth/google/native' }),
    );
    await adapter.exchange({
      authorizationCode: 'native-server-code',
      redirectUri: 'slogan://oauth/google/native',
    });
    const body = new URLSearchParams(String(fetchCalls[0]?.[1]?.body));
    expect(body.get('redirect_uri')).toBe('');
    expect(body.get('code_verifier')).toBeNull();
  });

  it('passes the registered browser origin when exchanging a Web popup code', async () => {
    fetchResults.push(Promise.resolve(jsonResponse({ id_token: 'provider-id-token' })));
    verifiedClaims({
      iss: 'accounts.google.com',
      sub: 'web-google-subject',
      aud: 'google-client',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const adapter = new GoogleOAuthAdapter(
      config({ GOOGLE_OAUTH_REDIRECT_URIS: 'http://localhost:8082' }),
    );
    await adapter.exchange({
      authorizationCode: 'web-popup-code',
      redirectUri: 'http://localhost:8082',
    });
    const body = new URLSearchParams(String(fetchCalls[0]?.[1]?.body));
    expect(body.get('redirect_uri')).toBe('http://localhost:8082');
    expect(body.get('code')).toBe('web-popup-code');
  });

  it.each([
    [{ iss: 'evil.example', sub: 'subject', aud: 'google-client', exp: 4_102_444_800 }, 'issuer'],
    [
      { iss: 'accounts.google.com', sub: 'subject', aud: 'other-client', exp: 4_102_444_800 },
      'audience',
    ],
    [{ iss: 'accounts.google.com', sub: 'subject', aud: 'google-client', exp: 1 }, 'expiry'],
  ])('rejects a Google token with an invalid %s claim set', async (claims) => {
    fetchResults.push(Promise.resolve(jsonResponse({ id_token: 'provider-id-token' })));
    verifiedClaims(claims);

    await expect(
      new GoogleOAuthAdapter(config()).exchange({
        authorizationCode: 'one-time-code',
        redirectUri: 'slogan://oauth/google',
      }),
    ).rejects.toMatchObject({ code: 'AUTH_CODE_REJECTED' });
  });

  it('rejects a Google ID token when signature verification fails', async () => {
    fetchResults.push(Promise.resolve(jsonResponse({ id_token: 'invalid-signature' })));
    verifyIdToken.mockRejectedValue(new Error('invalid token'));
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

  it('logs only a safe Google token rejection category', async () => {
    const warning = spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    fetchResults.push(
      Promise.resolve(
        jsonResponse({ error: 'invalid_grant', error_description: 'private provider detail' }, 400),
      ),
    );

    try {
      await expect(
        new GoogleOAuthAdapter(config()).exchange({
          authorizationCode: 'one-time-code',
          redirectUri: 'slogan://oauth/google',
        }),
      ).rejects.toMatchObject({
        code: 'AUTH_CODE_REJECTED',
        message: 'OAuth provider rejected the authorization code',
      });
      expect(warning).toHaveBeenCalledWith({
        event: 'google_token_exchange_rejected',
        status: 400,
        providerError: 'invalid_grant',
      });
      expect(JSON.stringify(warning.mock.calls)).not.toContain('one-time-code');
      expect(JSON.stringify(warning.mock.calls)).not.toContain('private provider detail');
    } finally {
      warning.mockRestore();
    }
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
