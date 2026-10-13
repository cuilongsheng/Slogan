import { useEffect } from 'react';
import { startForegroundPolling } from '../services/foregroundPolling';

export function useForegroundPolling(
  work: (current: () => boolean) => Promise<void>,
  interval: number | (() => number),
  enabled = true,
) {
  useEffect(
    () => (enabled ? startForegroundPolling(work, interval) : undefined),
    [work, interval, enabled],
  );
}
