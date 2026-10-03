import { createMobileApiClient } from '../../api/client';
import { MobileSession } from './session';

jest.mock('../../api/client', () => ({ createMobileApiClient: jest.fn() }));

const tokens = {
  accessToken: 'access-1',
  accessTokenExpiresInSeconds: 60,
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-10-01T00:00:00.000Z',
};
const me = { userId: 'user-1', onboardingState: 'PROFILE_REQUIRED', profile: null };

function setup(initial: string | null = null, now: () => number = () => 1_000_000) {
  let stored = initial;
  const storage = {
    getItemAsync: jest.fn(async () => stored),
    setItemAsync: jest.fn(async (_key: string, value: string) => {
      stored = value;
    }),
    deleteItemAsync: jest.fn(async () => {
      stored = null;
    }),
  };
  const client = { POST: jest.fn(), GET: jest.fn(), PUT: jest.fn() };
  (createMobileApiClient as jest.Mock).mockReturnValue(client);
  const session = new MobileSession('https://api.example.test', storage, now);
  return { session, storage, client, read: () => stored };
}

describe('mobile session', () => {
  it('stores native password session tokens only in secure storage', async () => {
    const { session, client, read } = setup();
    client.POST.mockResolvedValue({ data: { tokens }, response: { status: 200 } });
    await session.exchangePassword({ username: 'test_user', password: 'safe phrase 2026' });
    expect(client.POST).toHaveBeenCalledWith('/v1/auth/password/exchange', {
      body: { username: 'test_user', password: 'safe phrase 2026' },
    });
    expect(read()).toContain('refresh-1');
    expect(read()).not.toContain('safe phrase 2026');
  });
  it('exchanges a native Google server code and uses the stored bearer token', async () => {
    const { session, client, read } = setup();
    client.POST.mockResolvedValue({
      data: { userId: 'user-1', created: true, onboardingState: 'PROFILE_REQUIRED', tokens },
      response: { status: 200 },
    });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });
    await session.exchangeGoogle('code');
    expect(client.POST).toHaveBeenCalledWith('/v1/auth/oauth/{provider}/exchange', {
      params: { path: { provider: 'google' } },
      body: {
        authorizationCode: 'code',
        redirectUri: 'slogan://oauth/google/native',
      },
    });
    expect(read()).toContain('refresh-1');
    expect(await session.me()).toEqual(me);
    expect(client.GET).toHaveBeenCalledWith('/v1/me', {
      headers: { Authorization: 'Bearer access-1' },
    });
  });

  it('single-flights refresh and persists the rotated token before protected reads', async () => {
    let time = 1_000_000;
    const old = JSON.stringify({ tokens, accessExpiresAt: 1_060_000 });
    const { session, client, read } = setup(old, () => time);
    const next = { ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' };
    client.POST.mockResolvedValue({ data: next, response: { status: 200 } });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });
    await session.restore();
    time = 1_050_000;
    await Promise.all([session.me(), session.me()]);
    expect(client.POST).toHaveBeenCalledTimes(1);
    expect(read()).toContain('refresh-2');
    expect(client.GET).toHaveBeenCalledWith('/v1/me', {
      headers: { Authorization: 'Bearer access-2' },
    });
  });

  it('clears a rejected refresh token', async () => {
    const { session, client, read } = setup(JSON.stringify({ tokens, accessExpiresAt: 1_000_000 }));
    client.POST.mockResolvedValue({
      error: { code: 'REFRESH_TOKEN_REUSED' },
      response: { status: 401 },
    });
    await expect(session.restore()).rejects.toThrow('REFRESH_TOKEN_REUSED');
    expect(read()).toBeNull();
  });

  it('retries an authenticated feature request once after a server 401', async () => {
    const { session, client } = setup(JSON.stringify({ tokens, accessExpiresAt: 1_060_000 }));
    client.GET.mockResolvedValueOnce({ data: me, response: { status: 200 } });
    client.POST.mockResolvedValue({
      data: { ...tokens, accessToken: 'access-2', refreshToken: 'refresh-2' },
      response: { status: 200 },
    });
    await session.restore();
    const request = jest
      .fn()
      .mockResolvedValueOnce({ response: { status: 401 } })
      .mockResolvedValueOnce({ data: 'room-list', response: { status: 200 } });

    expect(await session.authorized(request)).toMatchObject({ data: 'room-list' });
    expect(request.mock.calls.map(([token]) => token)).toEqual(['access-1', 'access-2']);
  });
});
