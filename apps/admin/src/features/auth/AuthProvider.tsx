import { useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SloganApiPaths } from '@slogan/api-client';

import {
  adminApi,
  exchangeGoogle,
  exchangePassword,
  logoutBrowser,
  refreshAccessToken,
  setAccessToken,
} from '../../api/client';

type BackofficeMe =
  SloganApiPaths['/v1/backoffice/me']['get']['responses'][200]['content']['application/json'];
import { AuthContext, type AuthContextValue, type AuthState } from './auth-context';
let bootPromise: Promise<BackofficeMe | { forbiddenUserId: string | null } | null> | null = null;

async function loadIdentity(): Promise<BackofficeMe | { forbiddenUserId: string | null } | null> {
  const { data, response } = await adminApi.GET('/v1/backoffice/me');
  if (response.status === 403) {
    const own = await adminApi.GET('/v1/me');
    return { forbiddenUserId: own.data?.userId ?? null };
  }
  if (!response.ok || !data) return null;
  return data;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'checking', me: null });
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    if (!bootPromise) {
      bootPromise = (async () => {
        if (!(await refreshAccessToken())) return null;
        return loadIdentity();
      })().finally(() => {
        bootPromise = null;
      });
    }
    void bootPromise.then((me) => {
      if (!active) return;
      setState(
        me && 'forbiddenUserId' in me
          ? { status: 'forbidden', me: null, pendingUserId: me.forbiddenUserId ?? undefined }
          : me
            ? { status: 'ready', me }
            : { status: 'guest', me: null },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      async login(username, password) {
        const { data, error, response } = await exchangePassword(username, password);
        if (!response.ok || !data)
          throw new Error(error?.message || '登录失败，请检查用户名和密码');
        setAccessToken(data.accessToken);
        const me = await loadIdentity();
        if (me && 'forbiddenUserId' in me) {
          setState({
            status: 'forbidden',
            me: null,
            pendingUserId: me.forbiddenUserId ?? data.userId,
          });
          return;
        }
        if (!me) throw new Error('无法验证后台权限，请重试');
        setState({ status: 'ready', me });
      },
      async loginGoogle(authorizationCode) {
        const { data, error, response } = await exchangeGoogle(authorizationCode);
        if (!response.ok || !data) throw new Error(error?.message || 'Google 登录失败');
        setAccessToken(data.accessToken);
        const me = await loadIdentity();
        if (me && 'forbiddenUserId' in me) {
          setState({
            status: 'forbidden',
            me: null,
            pendingUserId: me.forbiddenUserId ?? data.userId,
          });
          return;
        }
        if (!me) throw new Error('无法验证后台权限，请重试');
        setState({ status: 'ready', me });
      },
      async logout() {
        try {
          await logoutBrowser();
        } finally {
          setAccessToken(null);
          queryClient.clear();
          setState({ status: 'guest', me: null });
        }
      },
    }),
    [queryClient, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
