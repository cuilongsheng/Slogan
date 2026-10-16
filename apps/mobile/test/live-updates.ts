// Component fixtures inject events explicitly. Transport ownership is tested with the real provider.
import { useCallback, useEffect, useRef } from 'react';
type Work = (current: () => boolean) => Promise<void>;
const listeners = new Map<string, Set<() => void>>();
export function emitLive(scope: string) {
  for (const listener of listeners.get(scope) ?? []) listener();
}
export function useForegroundLive(
  work: Work,
  scope: string | readonly string[],
  enabled = true,
  _resourceId?: string,
  initialSnapshot = true,
) {
  const key = typeof scope === 'string' ? scope : scope.join(',');
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = () => void work(() => alive);
    const scopes = key.split(',');
    for (const item of scopes) {
      const bucket = listeners.get(item) ?? new Set();
      listeners.set(item, bucket);
      bucket.add(run);
    }
    if (initialSnapshot) run();
    return () => {
      alive = false;
      for (const item of scopes) listeners.get(item)?.delete(run);
    };
  }, [work, key, enabled, initialSnapshot]);
}
export function useFocusedLive(work: Work, scope: string | readonly string[]) {
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useForegroundLive(work, scope);
  return useCallback(() => () => active.current, []);
}

export function useLiveUpdates() {
  return { owner: 'fixture-member', status: 'connected', subscribe: () => () => {} };
}
