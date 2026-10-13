import { useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../auth';
import { useForegroundPolling } from '../../hooks/useForegroundPolling';
import { SocialApi } from './api';

/** One foreground heartbeat across all routes, following server renewal advice. */
export function PresenceHeartbeat() {
  const { state, authorized } = useAuth();
  const api = useMemo(() => new SocialApi(authorized), [authorized]);
  const userId =
    state.kind === 'signedIn' && state.me.onboardingState === 'ELIGIBLE' ? state.me.userId : null;
  const period = useRef(30_000);
  const beat = useCallback(
    async (current: () => boolean) => {
      if (!userId) return;
      try {
        const result = await api.heartbeat();
        if (current())
          period.current = Math.max(5, Math.min(result.refreshAfterSeconds, 300)) * 1000;
      } catch {
        /* Existing voice sessions remain usable when presence is unavailable. */
      }
    },
    [api, userId],
  );
  const interval = useCallback(() => period.current, []);
  useForegroundPolling(beat, interval, !!userId);
  return null;
}
