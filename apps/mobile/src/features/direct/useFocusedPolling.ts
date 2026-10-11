import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';
/** No overlapping requests, no background polling, and no stale updates after blur. */
export function useFocusedPolling(
  work: (current: () => boolean) => Promise<void>,
  interval: number,
) {
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        running = false,
        epoch = 0,
        timer: ReturnType<typeof setTimeout> | undefined;
      const run = async () => {
        if (!alive || running || AppState.currentState !== 'active') return;
        running = true;
        const generation = epoch;
        try {
          await work(() => alive && epoch === generation);
        } finally {
          running = false;
          if (alive && AppState.currentState === 'active')
            timer = setTimeout(() => void run(), interval);
        }
      };
      const subscription = AppState.addEventListener('change', (state) => {
        epoch++;
        if (timer) clearTimeout(timer);
        if (state === 'active') void run();
      });
      void run();
      return () => {
        alive = false;
        epoch++;
        if (timer) clearTimeout(timer);
        subscription.remove();
      };
    }, [work, interval]),
  );
}
