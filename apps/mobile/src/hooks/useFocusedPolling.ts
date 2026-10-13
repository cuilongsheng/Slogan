import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { startForegroundPolling } from '../services/foregroundPolling';

/** Focus and visibility share one coalesced scheduler and stale-response fence. */
export function useFocusedPolling(
  work: (current: () => boolean) => Promise<void>,
  interval: number,
  enabled = true,
) {
  useFocusEffect(
    useCallback(
      () => (enabled ? startForegroundPolling(work, interval) : undefined),
      [work, interval, enabled],
    ),
  );
}
