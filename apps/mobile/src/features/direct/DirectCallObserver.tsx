import { useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { AppState } from 'react-native';
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
    if (!userId) return;
    let stopped = false,
      busy = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || busy || AppState.currentState !== 'active') return;
      busy = true;
      try {
        await flushCallEnds(userId, api);
        if (!latestPath.current.startsWith('/calls/') && !navigating.current) {
          const page = await api.calls();
          if (!stopped) {
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
        }
      } catch {
        /* Incoming-call detection must not replace the current screen with an error. */
      } finally {
        busy = false;
        if (!stopped && AppState.currentState === 'active')
          timer = setTimeout(() => void poll(), 5000);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (timer) clearTimeout(timer);
      if (state === 'active') void poll();
    });
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [userId, api, router]);
  return null;
}
