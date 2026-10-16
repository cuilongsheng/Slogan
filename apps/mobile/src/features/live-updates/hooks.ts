import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { isAppForeground } from '../../services/foregroundPolling';
import { LatestRequestQueue } from '../../services/latestRequestQueue';
import { useLiveUpdates, type LiveScope } from './context';
type Work = (current: () => boolean) => Promise<void>;
function observe(
  work: Work,
  subscribe: (listener: () => void) => () => void,
  owner?: string | null,
  initiallyReady = true,
  initialSnapshot = true,
) {
  const requests = new LatestRequestQueue();
  let alive = true,
    epoch = 0;
  const run = () => {
    if (!alive || owner === null || !isAppForeground()) return;
    const generation = epoch;
    const current = () => alive && isAppForeground() && epoch === generation;
    void requests
      .enqueue(async () => {
        if (current()) await work(current);
      })
      .catch(() => undefined);
  };
  const changed = () => {
    epoch++;
    run();
  };
  let initial: ReturnType<typeof setTimeout> | undefined;
  const remove = subscribe(() => {
    if (initial) clearTimeout(initial);
    initial = undefined;
    run();
  });
  const native = AppState.addEventListener('change', changed);
  const browser = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
  browser?.addEventListener('visibilitychange', changed);
  if (initialSnapshot) {
    if (initiallyReady) run();
    else initial = setTimeout(run, 3000); // One initial snapshot remains available if only streaming is unreachable.
  }
  return {
    fence: () => {
      const generation = epoch;
      return () => alive && owner !== null && isAppForeground() && epoch === generation;
    },
    stop: () => {
      alive = false;
      epoch++;
      if (initial) clearTimeout(initial);
      remove();
      native.remove();
      browser?.removeEventListener('visibilitychange', changed);
    },
  };
}
export function useFocusedLive(
  work: Work,
  scope: LiveScope | readonly LiveScope[],
  resourceId?: string,
) {
  const scopeKey = typeof scope === 'string' ? scope : scope.join(',');
  const { subscribe, owner, status } = useLiveUpdates();
  const ready = useRef(status === 'connected');
  useLayoutEffect(() => {
    ready.current = status === 'connected';
  }, [status]);
  const fence = useRef<(() => () => boolean) | null>(null);
  useFocusEffect(
    useCallback(() => {
      const observer = observe(
        work,
        (fn) => {
          const removes = scopeKey.split(',').map((s) => subscribe(s as LiveScope, fn, resourceId));
          return () => removes.forEach((remove) => remove());
        },
        owner,
        ready.current,
      );
      fence.current = observer.fence;
      return () => {
        fence.current = null;
        observer.stop();
      };
    }, [work, scopeKey, subscribe, owner, resourceId]),
  );
  return useCallback(() => fence.current?.() ?? (() => false), []);
}

export function useForegroundLive(
  work: Work,
  scope: LiveScope | readonly LiveScope[],
  enabled = true,
  resourceId?: string,
  initialSnapshot = true,
) {
  const scopeKey = typeof scope === 'string' ? scope : scope.join(',');
  const { subscribe, owner, status } = useLiveUpdates();
  const ready = useRef(status === 'connected');
  useLayoutEffect(() => {
    ready.current = status === 'connected';
  }, [status]);
  useEffect(
    () =>
      enabled
        ? observe(
            work,
            (fn) => {
              const removes = scopeKey
                .split(',')
                .map((s) => subscribe(s as LiveScope, fn, resourceId));
              return () => removes.forEach((remove) => remove());
            },
            owner,
            ready.current,
            initialSnapshot,
          ).stop
        : undefined,
    [work, scopeKey, subscribe, owner, enabled, resourceId, initialSnapshot],
  );
}
