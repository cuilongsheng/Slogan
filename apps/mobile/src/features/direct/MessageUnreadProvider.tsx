import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth';
import { useForegroundLive } from '../live-updates';
import { isAppForeground } from '../../services/foregroundPolling';
import { DirectApi } from './api';

const Context = createContext({ count: 0, refresh: async () => {} });

export function MessageUnreadProvider({ children }: { children: ReactNode }) {
  const { state, authorized } = useAuth();
  const userId =
    state.kind === 'signedIn' && state.me.onboardingState === 'ELIGIBLE' ? state.me.userId : null;
  const api = useMemo(() => new DirectApi(authorized), [authorized]);
  const [snapshot, setSnapshot] = useState<{ owner: string | null; count: number }>({
    owner: null,
    count: 0,
  });
  const actor = useRef(userId);
  useEffect(() => {
    actor.current = userId;
  }, [userId]);
  const pending = useRef<{ owner: string; request: Promise<void> } | null>(null);
  const load = useCallback(
    async (current: () => boolean = () => true) => {
      if (!userId || !isAppForeground()) return;
      if (pending.current?.owner === userId) {
        await pending.current.request;
        if (!current() || actor.current !== userId || !isAppForeground()) return;
        if (pending.current?.owner === userId) return pending.current.request;
      }
      const request = api
        .unread()
        .then((result) => {
          if (current() && actor.current === userId && isAppForeground())
            setSnapshot({ owner: userId, count: result.unreadCount });
        })
        .catch(() => {
          /* Preserve the last confirmed badge while offline. */
        })
        .finally(() => {
          if (pending.current?.request === request) pending.current = null;
        });
      pending.current = { owner: userId, request };
      await request;
    },
    [api, userId],
  );
  useForegroundLive(load, 'unread', !!userId);
  const refresh = useCallback(() => load(), [load]);
  const value = useMemo(
    () => ({ count: snapshot.owner === userId ? snapshot.count : 0, refresh }),
    [snapshot, userId, refresh],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMessageUnread() {
  return useContext(Context);
}
