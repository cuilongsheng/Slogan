import { useCallback } from 'react';
import { useAuth } from '../auth';
import { useForegroundLive } from './hooks';
export function AccountUpdatesObserver() {
  const { state, refreshMe } = useAuth();
  const work = useCallback(
    async (current: () => boolean) => {
      if (current()) await refreshMe();
    },
    [refreshMe],
  );
  useForegroundLive(work, ['account', 'safety'], state.kind === 'signedIn');
  return null;
}
