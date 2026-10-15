import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, Platform } from 'react-native';
import { isAppForeground } from '../../services/foregroundPolling';
import { useLiveUpdates, type LiveScope } from './context';
type Work = (current: () => boolean) => Promise<void>;
function observe(
  work: Work,
  subscribe: (listener: () => void) => () => void,
  owner?: string | null,
) {
  let alive = true,
    epoch = 0;
  const run = () => {
    if (!alive || owner === null || !isAppForeground()) return;
    const generation = epoch;
    void work(() => alive && isAppForeground() && epoch === generation).catch(() => undefined);
  };
  const changed = () => {
    epoch++;
    run();
  };
  const remove = subscribe(run);
  const native = AppState.addEventListener('change', changed);
  const browser = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
  browser?.addEventListener('visibilitychange', changed);
  run();
  return {
    fence: () => {
      const generation = epoch;
      return () => alive && owner !== null && isAppForeground() && epoch === generation;
    },
    stop: () => {
      alive = false;
      epoch++;
      remove();
      native.remove();
      browser?.removeEventListener('visibilitychange', changed);
    },
  };
}
export function useFocusedLive(work: Work, scope: LiveScope) {
  const { subscribe, owner } = useLiveUpdates();
  const fence = useRef<(() => () => boolean) | null>(null);
  useFocusEffect(
    useCallback(() => {
      const observer = observe(work, (fn) => subscribe(scope, fn), owner);
      fence.current = observer.fence;
      return () => {
        fence.current = null;
        observer.stop();
      };
    }, [work, scope, subscribe, owner]),
  );
  return useCallback(() => fence.current?.() ?? (() => false), []);
}

export function useForegroundLive(work: Work, scope: LiveScope, enabled = true) {
  const { subscribe, owner } = useLiveUpdates();
  useEffect(
    () => (enabled ? observe(work, (fn) => subscribe(scope, fn), owner).stop : undefined),
    [work, scope, subscribe, owner, enabled],
  );
}
