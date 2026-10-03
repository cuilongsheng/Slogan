import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { googleSignOut } from '../../services/googleSignIn';

import { MobileSession, SessionError, type Me, type ProfileInput } from './session';

type AuthState =
  | { kind: 'loading' }
  | { kind: 'signedOut'; message?: string }
  | { kind: 'signedIn'; me: Me }
  | { kind: 'error'; message: string };

interface AuthContextValue {
  state: AuthState;
  suggestedProfile: { avatarUrl?: string; displayName?: string } | null;
  loginGoogle(code: string): Promise<void>;
  loginPassword(username: string, password: string): Promise<void>;
  putProfile(profile: ProfileInput): Promise<Me>;
  retry(): Promise<void>;
  logout(): Promise<void>;
  authorized<T extends { response: Response }>(
    request: (accessToken: string) => Promise<T>,
  ): Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useMemo(() => new MobileSession(), []);
  const [state, setState] = useState<AuthState>({ kind: 'loading' });
  const [suggestedProfile, setSuggestedProfile] =
    useState<AuthContextValue['suggestedProfile']>(null);

  const retry = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const me = await session.restore();
      setSuggestedProfile(session.suggestedProfile ?? null);
      setState(me ? { kind: 'signedIn', me } : { kind: 'signedOut' });
    } catch (error) {
      setState(
        error instanceof SessionError && error.code === 'AUTH'
          ? { kind: 'signedOut' }
          : { kind: 'error', message: 'SESSION_RESTORE_FAILED' },
      );
    }
  }, [session]);

  useEffect(() => {
    void session
      .restore()
      .then((me) => {
        setSuggestedProfile(session.suggestedProfile ?? null);
        setState(me ? { kind: 'signedIn', me } : { kind: 'signedOut' });
      })
      .catch((error: unknown) =>
        setState(
          error instanceof SessionError && error.code === 'AUTH'
            ? { kind: 'signedOut' }
            : { kind: 'error', message: 'SESSION_RESTORE_FAILED' },
        ),
      );
  }, [session]);

  const loginGoogle = useCallback(
    async (code: string) => {
      const result = await session.exchangeGoogle(code);
      setSuggestedProfile(result.suggestedProfile ?? null);
      const me = await session.me();
      setState({ kind: 'signedIn', me });
    },
    [session],
  );

  const loginPassword = useCallback(
    async (username: string, password: string) => {
      await session.exchangePassword({ username, password });
      setSuggestedProfile(null);
      const me = await session.me();
      setState({ kind: 'signedIn', me });
    },
    [session],
  );

  const logout = useCallback(async () => {
    const revoked = await session.logout().catch(() => false);
    await googleSignOut().catch(() => null);
    setSuggestedProfile(null);
    setState({ kind: 'signedOut', ...(revoked ? {} : { message: 'LOGOUT_UNCONFIRMED' }) });
  }, [session]);

  const putProfile = useCallback(
    async (profile: ProfileInput) => {
      try {
        const me = await session.putProfile(profile);
        setState({ kind: 'signedIn', me });
        return me;
      } catch (error) {
        if (error instanceof SessionError && error.code === 'AUTH') setState({ kind: 'signedOut' });
        throw error;
      }
    },
    [session],
  );

  const authorized = useCallback(
    async <T extends { response: Response }>(
      request: (accessToken: string) => Promise<T>,
    ): Promise<T> => {
      try {
        const result = await session.authorized(request);
        if (result.response.status === 401) setState({ kind: 'signedOut' });
        return result;
      } catch (error) {
        if (error instanceof SessionError && error.code === 'AUTH') setState({ kind: 'signedOut' });
        throw error;
      }
    },
    [session],
  );

  const value = useMemo(
    () => ({
      state,
      suggestedProfile,
      loginGoogle,
      loginPassword,
      putProfile,
      retry,
      logout,
      authorized,
    }),
    [state, suggestedProfile, loginGoogle, loginPassword, putProfile, retry, logout, authorized],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}
