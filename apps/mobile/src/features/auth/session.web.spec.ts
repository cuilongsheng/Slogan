import { createMobileApiClient } from '../../api/client';
import { profileHintStorage, sessionStorage } from '../../services/sessionStorage';
import { MobileSession } from './session';

jest.mock('../../api/client', () => ({ createMobileApiClient: jest.fn() }));
jest.mock('../../services/sessionStorage', () => ({
  browserSession: true,
  sessionStorage: {
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
  },
  profileHintStorage: {
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
  },
}));
jest.mock('../../services/googleSignIn', () => ({
  googleRedirectUri: () => 'http://localhost:8082',
}));

const me = { userId: 'user-1', onboardingState: 'PROFILE_REQUIRED', profile: null };

describe('browser session', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exchanges a password through the cookie endpoint without browser token storage', async () => {
    const client = { POST: jest.fn(), GET: jest.fn(), PUT: jest.fn() };
    (createMobileApiClient as jest.Mock).mockReturnValue(client);
    client.POST.mockResolvedValueOnce({
      data: { accessToken: 'access-1', accessTokenExpiresInSeconds: 900 },
      response: { status: 200 },
    });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });
    const session = new MobileSession('http://localhost:3000');
    await session.exchangePassword({ username: 'test_user', password: 'safe phrase 2026' });
    expect(client.POST).toHaveBeenCalledWith('/v1/auth/web/password/exchange', {
      body: { username: 'test_user', password: 'safe phrase 2026' },
    });
    expect(sessionStorage.setItemAsync).not.toHaveBeenCalled();
    expect(await session.me()).toEqual(me);
  });

  it('restores after a page reload through the cookie endpoint without persisting tokens', async () => {
    const client = { POST: jest.fn(), GET: jest.fn(), PUT: jest.fn() };
    (createMobileApiClient as jest.Mock).mockReturnValue(client);
    client.POST.mockResolvedValueOnce({
      data: {
        userId: 'user-1',
        created: true,
        onboardingState: 'PROFILE_REQUIRED',
        accessToken: 'access-1',
        accessTokenExpiresInSeconds: 900,
        suggestedProfile: { displayName: 'New user', avatarUrl: 'https://example.com/avatar.png' },
      },
      response: { status: 200 },
    });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });

    const firstPage = new MobileSession('http://localhost:3000');
    await firstPage.exchangeGoogle('one-time-code');
    expect(client.POST).toHaveBeenCalledWith('/v1/auth/web/google/exchange', {
      body: { authorizationCode: 'one-time-code', redirectUri: 'http://localhost:8082' },
    });
    expect(sessionStorage.setItemAsync).not.toHaveBeenCalled();
    expect(profileHintStorage.setItemAsync).toHaveBeenCalledWith(
      'slogan.auth.profile-hint.v1',
      JSON.stringify({
        userId: 'user-1',
        suggestedProfile: {
          displayName: 'New user',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    );

    client.POST.mockResolvedValueOnce({
      data: { accessToken: 'access-2', accessTokenExpiresInSeconds: 900 },
      response: { status: 200 },
    });
    (profileHintStorage.getItemAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({
        userId: 'user-1',
        suggestedProfile: {
          displayName: 'New user',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    );
    const reloadedPage = new MobileSession('http://localhost:3000');
    expect(await reloadedPage.restore()).toEqual(me);
    expect(reloadedPage.suggestedProfile).toEqual({
      displayName: 'New user',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(client.POST).toHaveBeenCalledWith('/v1/auth/web/refresh');
    expect(client.GET).toHaveBeenCalledWith('/v1/me', {
      headers: { Authorization: 'Bearer access-2' },
    });
    expect(sessionStorage.getItemAsync).not.toHaveBeenCalled();
  });

  it('logs out through the cookie endpoint and stays signed out after reload', async () => {
    const client = { POST: jest.fn(), GET: jest.fn(), PUT: jest.fn() };
    (createMobileApiClient as jest.Mock).mockReturnValue(client);
    client.POST.mockResolvedValueOnce({
      data: { accessToken: 'access-1', accessTokenExpiresInSeconds: 900 },
      response: { status: 200 },
    });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });
    const session = new MobileSession('http://localhost:3000');
    await session.restore();

    client.POST.mockResolvedValueOnce({ response: { ok: true, status: 204 } });
    expect(await session.logout()).toBe(true);
    expect(client.POST).toHaveBeenCalledWith('/v1/auth/web/logout');

    client.POST.mockResolvedValueOnce({
      error: { code: 'REFRESH_TOKEN_INVALID' },
      response: { status: 401 },
    });
    expect(await new MobileSession('http://localhost:3000').restore()).toBeNull();
  });

  it('coalesces simultaneous page restores so a rotating cookie is used once', async () => {
    const client = { POST: jest.fn(), GET: jest.fn(), PUT: jest.fn() };
    (createMobileApiClient as jest.Mock).mockReturnValue(client);
    client.POST.mockResolvedValue({
      data: { accessToken: 'access-1', accessTokenExpiresInSeconds: 900 },
      response: { status: 200 },
    });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });
    const session = new MobileSession('http://localhost:3000');

    expect(await Promise.all([session.restore(), session.restore()])).toEqual([me, me]);
    expect(client.POST).toHaveBeenCalledTimes(1);
  });

  it('discards a profile hint that belongs to another signed-in account', async () => {
    const client = { POST: jest.fn(), GET: jest.fn(), PUT: jest.fn() };
    (createMobileApiClient as jest.Mock).mockReturnValue(client);
    client.POST.mockResolvedValue({
      data: { accessToken: 'access-1', accessTokenExpiresInSeconds: 900 },
      response: { status: 200 },
    });
    client.GET.mockResolvedValue({ data: me, response: { status: 200 } });
    (profileHintStorage.getItemAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify({ userId: 'different-user', suggestedProfile: { displayName: 'Other user' } }),
    );

    const session = new MobileSession('http://localhost:3000');
    expect(await session.restore()).toEqual(me);
    expect(session.suggestedProfile).toBeUndefined();
    expect(profileHintStorage.deleteItemAsync).toHaveBeenCalledWith('slogan.auth.profile-hint.v1');
  });
});
