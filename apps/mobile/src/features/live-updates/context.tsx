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
import { AppState, Platform } from 'react-native';
import { useAuth } from '../auth';
import { isAppForeground } from '../../services/foregroundPolling';
import { receiveLiveUpdates, type LiveEvent } from './api';
export type LiveScope = 'rooms' | 'partners' | 'messages';
type Status = 'connecting' | 'connected' | 'reconnecting';
export const LiveUpdatesContext = createContext<{
  owner: string | null;
  status: Status;
  subscribe: (scope: LiveScope, listener: () => void) => () => void;
}>({ owner: null, status: 'connecting', subscribe: () => () => {} });
export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const { state, authorized } = useAuth();
  const owner =
    state.kind === 'signedIn' && state.me.onboardingState === 'ELIGIBLE' ? state.me.userId : null;
  const listeners = useRef(new Map<LiveScope, Set<() => void>>());
  const [snapshot, setSnapshot] = useState<{ owner: string | null; status: Status }>({
    owner: null,
    status: 'connecting',
  });
  const subscribe = useCallback((scope: LiveScope, listener: () => void) => {
    const bucket = listeners.current.get(scope) ?? new Set();
    listeners.current.set(scope, bucket);
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
    };
  }, []);
  useEffect(() => {
    if (!owner) return;
    let alive = true,
      epoch = 0,
      attempts = 0,
      cursor: string | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      controller: AbortController | undefined;
    const current = (generation: number) => alive && generation === epoch && isAppForeground();
    const stop = () => {
      epoch++;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
    const connect = async () => {
      if (!alive || !isAppForeground()) return;
      const generation = ++epoch;
      let renewing = false;
      controller = new AbortController();
      const event = (value: LiveEvent, id: string) => {
        if (!current(generation)) return;
        if (id) cursor = id;
        if (value.scope === 'renew') renewing = true;
        else if (value.scope === 'reset') {
          attempts = 0;
          setSnapshot({ owner, status: 'connected' });
          for (const bucket of listeners.current.values()) for (const fn of bucket) fn();
        } else if (
          value.scope === 'rooms' ||
          value.scope === 'partners' ||
          value.scope === 'messages'
        )
          for (const fn of listeners.current.get(value.scope) ?? []) fn();
      };
      try {
        await receiveLiveUpdates(authorized, controller.signal, cursor, event);
      } catch {
        /* Snapshot data remains visible and manual refresh remains usable. */
      }
      if (current(generation)) {
        if (!renewing) setSnapshot({ owner, status: 'reconnecting' });
        timer = setTimeout(
          () => void connect(),
          renewing
            ? 0
            : Math.min(30000, 500 * 2 ** Math.min(attempts++, 6)) * (0.75 + Math.random() * 0.5),
        );
      }
    };
    const resume = () => {
      stop();
      if (isAppForeground()) void connect();
    };
    const native = AppState.addEventListener('change', resume);
    const browser = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
    browser?.addEventListener('visibilitychange', resume);
    void Promise.resolve().then(connect);
    return () => {
      alive = false;
      stop();
      native.remove();
      browser?.removeEventListener('visibilitychange', resume);
    };
  }, [owner, authorized]);
  const value = useMemo(
    () => ({
      owner,
      status: snapshot.owner === owner ? snapshot.status : ('connecting' as Status),
      subscribe,
    }),
    [owner, snapshot, subscribe],
  );
  return <LiveUpdatesContext.Provider value={value}>{children}</LiveUpdatesContext.Provider>;
}
export function useLiveUpdates() {
  return useContext(LiveUpdatesContext);
}
