import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useForegroundLive } from '../live-updates';
import { useAuth } from '../auth';
import { DirectApi } from './api';
import { flushCallEnds, locallyEnded } from './callRecovery';
export function DirectCallObserver() {
  const { state, authorized } = useAuth(),
    router = useRouter(),
    path = usePathname();
  const api = useMemo(() => new DirectApi(authorized), [authorized]);
  const latestPath = useRef(path),
    navigating = useRef<string | null>(null);
  useEffect(() => {
    latestPath.current = path;
    if (path.startsWith('/calls/')) navigating.current = null;
  }, [path]);
  const userId =
    state.kind === 'signedIn' && state.me.onboardingState === 'ELIGIBLE' ? state.me.userId : null;
  useEffect(() => {
    navigating.current = null;
  }, [userId]);
  const poll = useCallback(
    async (current: () => boolean) => {
      if (!userId) return;
      try {
        await flushCallEnds(userId, api);
        if (!current()) return;
        if (!latestPath.current.startsWith('/calls/') && !navigating.current) {
          const page = await api.calls();
          if (!current()) return;
          const call = page.items.find(
            (item) =>
              !locallyEnded(item.id) && (item.status === 'ACTIVE' || item.status === 'RINGING'),
          );
          if (call && !latestPath.current.startsWith('/calls/') && !navigating.current) {
            navigating.current = call.id;
            try {
              router.push(`/calls/${call.id}`);
            } catch {
              navigating.current = null;
            }
          }
        }
      } catch {
        // Incoming-call detection must not replace the current screen with an error.
      }
    },
    [userId, api, router],
  );
  useForegroundLive(poll, 'calls', !!userId);
  return null;
}
