import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../auth';
import { SocialApi } from './api';

/** One authenticated foreground heartbeat for the entire app, independent of route. */
export function PresenceHeartbeat() {
  const { state, authorized } = useAuth();
  const api = useMemo(() => new SocialApi(authorized), [authorized]);
  const userId =
    state.kind === 'signedIn' && state.me.onboardingState === 'ELIGIBLE' ? state.me.userId : null;

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };
    const beat = async () => {
      if (disposed || inFlight || AppState.currentState !== 'active') return;
      clearTimer();
      inFlight = true;
      let seconds = 30;
      try {
        const result = await api.heartbeat();
        seconds = Math.max(5, Math.min(result.refreshAfterSeconds, 300));
      } catch {
        // Presence failure must never interrupt joining, listening or leaving.
      } finally {
        inFlight = false;
        if (!disposed && AppState.currentState === 'active') {
          timer = setTimeout(() => {
            void beat();
          }, seconds * 1000);
        }
      }
    };
    const subscription = AppState.addEventListener('change', (next) => {
      clearTimer();
      if (next === 'active') void beat();
    });
    void beat();
    return () => {
      disposed = true;
      clearTimer();
      subscription.remove();
    };
  }, [api, userId]);
  return null;
}
