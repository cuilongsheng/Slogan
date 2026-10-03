import type { SloganApiClient, SloganApiPaths } from '@slogan/api-client';
import { browserSession, profileHintStorage, sessionStorage } from '../../services/sessionStorage';

import { createMobileApiClient } from '../../api/client';
import { googleRedirectUri } from '../../services/googleSignIn';

type OAuthResult =
  SloganApiPaths['/v1/auth/oauth/{provider}/exchange']['post']['responses'][200]['content']['application/json'];
type TokenPair = OAuthResult['tokens'];
type BrowserToken =
  SloganApiPaths['/v1/auth/web/refresh']['post']['responses'][200]['content']['application/json'];
type BrowserOAuthResult =
  SloganApiPaths['/v1/auth/web/google/exchange']['post']['responses'][200]['content']['application/json'];
type PasswordLogin =
  SloganApiPaths['/v1/auth/password/exchange']['post']['requestBody']['content']['application/json'];
export type Me = SloganApiPaths['/v1/me']['get']['responses'][200]['content']['application/json'];
export type ProfileInput =
  SloganApiPaths['/v1/me/profile']['put']['requestBody']['content']['application/json'];

type Storage = typeof sessionStorage;
type SavedSession = {
  tokens: BrowserToken & Partial<Pick<TokenPair, 'refreshToken' | 'refreshTokenExpiresAt'>>;
  accessExpiresAt: number;
  suggestedProfile?: OAuthResult['suggestedProfile'];
};
const STORAGE_KEY = 'slogan.auth.session.v1';
const PROFILE_HINT_KEY = 'slogan.auth.profile-hint.v1';

export class SessionError extends Error {
  constructor(
    public readonly code: 'CONFIG' | 'AUTH' | 'NETWORK' | 'SERVER',
    message: string,
  ) {
    super(message);
  }
}

export function validAvatarUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export class MobileSession {
  private saved: SavedSession | null = null;
  private refreshInFlight: Promise<void> | null = null;
  private browserRestoreInFlight: Promise<Me | null> | null = null;
  private readonly client: SloganApiClient | null;

  get suggestedProfile(): OAuthResult['suggestedProfile'] | undefined {
    return this.saved?.suggestedProfile;
  }

  constructor(
    baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL,
    private readonly storage: Storage = sessionStorage,
    private readonly now: () => number = Date.now,
  ) {
    this.client = baseUrl ? createMobileApiClient(baseUrl) : null;
  }

  private api(): SloganApiClient {
    if (!this.client) throw new SessionError('CONFIG', 'API base URL is not configured');
    return this.client;
  }

  async restore(): Promise<Me | null> {
    if (browserSession) {
      if (!this.browserRestoreInFlight) {
        this.browserRestoreInFlight = this.restoreBrowser().finally(() => {
          this.browserRestoreInFlight = null;
        });
      }
      return this.browserRestoreInFlight;
    }
    const raw = await this.storage.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isSavedSession(parsed)) throw new Error('Invalid saved session');
      this.saved = parsed;
    } catch {
      await this.clear();
      return null;
    }
    return this.me();
  }

  private async restoreBrowser(): Promise<Me | null> {
    if (this.saved) return this.me();
    const { data, error, response } = await this.api().POST('/v1/auth/web/refresh');
    if (!data) {
      if (response.status === 400 || response.status === 401) {
        await profileHintStorage.deleteItemAsync(PROFILE_HINT_KEY);
        return null;
      }
      throw responseError(response.status, error);
    }
    await this.save(data);
    const me = await this.me();
    const rawHint = await profileHintStorage.getItemAsync(PROFILE_HINT_KEY);
    if (rawHint) {
      try {
        const hint: unknown = JSON.parse(rawHint);
        if (isProfileHint(hint) && hint.userId === me.userId) {
          this.rememberSuggestedProfile(hint.suggestedProfile);
        } else {
          await profileHintStorage.deleteItemAsync(PROFILE_HINT_KEY);
        }
      } catch {
        await profileHintStorage.deleteItemAsync(PROFILE_HINT_KEY);
      }
    }
    return me;
  }

  async exchangeGoogle(authorizationCode: string): Promise<Pick<OAuthResult, 'suggestedProfile'>> {
    if (browserSession) {
      const { data, error, response } = await this.api().POST('/v1/auth/web/google/exchange', {
        body: { authorizationCode, redirectUri: googleRedirectUri() },
      });
      if (!data) throw responseError(response.status, error);
      await this.save(data, data.suggestedProfile);
      if (data.suggestedProfile) {
        await profileHintStorage.setItemAsync(
          PROFILE_HINT_KEY,
          JSON.stringify({ userId: data.userId, suggestedProfile: data.suggestedProfile }),
        );
      } else {
        await profileHintStorage.deleteItemAsync(PROFILE_HINT_KEY);
      }
      return data.suggestedProfile ? { suggestedProfile: data.suggestedProfile } : {};
    }
    const { data, error, response } = await this.api().POST('/v1/auth/oauth/{provider}/exchange', {
      params: { path: { provider: 'google' } },
      body: { authorizationCode, redirectUri: googleRedirectUri() },
    });
    if (!data) throw responseError(response.status, error);
    await this.save(data.tokens, data.suggestedProfile);
    return data;
  }

  async exchangePassword(body: PasswordLogin): Promise<void> {
    if (browserSession) {
      const { data, error, response } = await this.api().POST('/v1/auth/web/password/exchange', {
        body,
      });
      if (!data) throw responseError(response.status, error);
      await profileHintStorage.deleteItemAsync(PROFILE_HINT_KEY);
      this.saved = null;
      await this.save(data, undefined);
      return;
    }
    const { data, error, response } = await this.api().POST('/v1/auth/password/exchange', {
      body,
    });
    if (!data) throw responseError(response.status, error);
    this.saved = null;
    await this.save(data.tokens, undefined);
  }

  async me(): Promise<Me> {
    let token = await this.accessToken();
    let result = await this.api().GET('/v1/me', { headers: { Authorization: `Bearer ${token}` } });
    if (result.response.status === 401) {
      await this.refresh();
      token = await this.accessToken();
      result = await this.api().GET('/v1/me', { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!result.data) {
      if (result.response.status === 401) await this.clear();
      throw responseError(result.response.status, result.error);
    }
    return result.data;
  }

  async authorized<T extends { response: Response }>(
    request: (accessToken: string) => Promise<T>,
  ): Promise<T> {
    let result = await request(await this.accessToken());
    if (result.response.status === 401) {
      await this.refresh();
      result = await request(await this.accessToken());
    }
    if (result.response.status === 401) await this.clear();
    return result;
  }

  async putProfile(body: ProfileInput): Promise<Me> {
    const token = await this.accessToken();
    const { data, error, response } = await this.api().PUT('/v1/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
      body,
    });
    if (!data) {
      if (response.status === 401) await this.clear();
      throw responseError(response.status, error);
    }
    return data;
  }

  async logout(): Promise<boolean> {
    let revoked = false;
    try {
      if (browserSession) {
        const { response } = await this.api().POST('/v1/auth/web/logout');
        revoked = response.ok;
      } else if (this.saved) {
        const token = await this.accessToken();
        const { response } = await this.api().POST('/v1/auth/logout', {
          headers: { Authorization: `Bearer ${token}` },
        });
        revoked = response.ok;
      }
    } finally {
      await this.clear();
    }
    return revoked;
  }

  async clear(): Promise<void> {
    this.saved = null;
    await this.storage.deleteItemAsync(STORAGE_KEY);
    if (browserSession) await profileHintStorage.deleteItemAsync(PROFILE_HINT_KEY);
  }

  private rememberSuggestedProfile(suggestedProfile: NonNullable<OAuthResult['suggestedProfile']>) {
    if (this.saved) this.saved.suggestedProfile = suggestedProfile;
  }

  private async save(
    tokens: TokenPair | BrowserToken | BrowserOAuthResult,
    suggestedProfile = this.saved?.suggestedProfile,
  ): Promise<void> {
    const next = {
      tokens,
      accessExpiresAt: this.now() + tokens.accessTokenExpiresInSeconds * 1000,
      ...(suggestedProfile ? { suggestedProfile } : {}),
    };
    if (!browserSession) await this.storage.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    this.saved = next;
  }

  private async accessToken(): Promise<string> {
    if (!this.saved) throw new SessionError('AUTH', 'No active session');
    if (this.saved.accessExpiresAt - this.now() < 30_000) await this.refresh();
    if (!this.saved) throw new SessionError('AUTH', 'Session expired');
    return this.saved.tokens.accessToken;
  }

  private async refresh(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.doRefresh().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async doRefresh(): Promise<void> {
    if (!this.saved) throw new SessionError('AUTH', 'No active session');
    if (browserSession) {
      const { data, error, response } = await this.api().POST('/v1/auth/web/refresh');
      if (!data) {
        if (response.status === 400 || response.status === 401) await this.clear();
        throw responseError(response.status, error);
      }
      await this.save(data);
      return;
    }
    if (!this.saved.tokens.refreshToken) throw new SessionError('AUTH', 'No refresh token');
    const { data, error, response } = await this.api().POST('/v1/auth/refresh', {
      body: { refreshToken: this.saved.tokens.refreshToken },
    });
    if (!data) {
      if (response.status === 400 || response.status === 401) await this.clear();
      throw responseError(response.status, error);
    }
    await this.save(data);
  }
}

function isProfileHint(value: unknown): value is {
  userId: string;
  suggestedProfile: NonNullable<OAuthResult['suggestedProfile']>;
} {
  if (!value || typeof value !== 'object') return false;
  const hint = value as { userId?: unknown; suggestedProfile?: unknown };
  if (typeof hint.userId !== 'string' || !hint.suggestedProfile) return false;
  const suggestion = hint.suggestedProfile as { displayName?: unknown; avatarUrl?: unknown };
  return (
    typeof suggestion === 'object' &&
    (suggestion.displayName === undefined || typeof suggestion.displayName === 'string') &&
    (suggestion.avatarUrl === undefined || typeof suggestion.avatarUrl === 'string')
  );
}

function isSavedSession(value: unknown): value is SavedSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SavedSession>;
  return (
    typeof candidate.accessExpiresAt === 'number' &&
    typeof candidate.tokens?.accessToken === 'string' &&
    typeof candidate.tokens.refreshToken === 'string' &&
    typeof candidate.tokens.refreshTokenExpiresAt === 'string'
  );
}

function responseError(status: number, error: unknown): SessionError {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (status === 0 || status >= 500)
    return new SessionError('NETWORK', code || 'Service unavailable');
  if (status === 401 || code.startsWith('AUTH_') || code.startsWith('REFRESH_'))
    return new SessionError('AUTH', code || 'Authentication failed');
  return new SessionError('SERVER', code || 'Request failed');
}
