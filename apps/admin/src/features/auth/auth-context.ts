import { createContext, useContext } from 'react';
import type { SloganApiPaths } from '@slogan/api-client';

type BackofficeMe =
  SloganApiPaths['/v1/backoffice/me']['get']['responses'][200]['content']['application/json'];
export type AuthState = {
  status: 'checking' | 'guest' | 'forbidden' | 'ready';
  me: BackofficeMe | null;
  pendingUserId?: string | undefined;
  error?: string;
};
export type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<void>;
  loginGoogle: (authorizationCode: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
