import { AppState, Platform } from 'react-native';

export function isAppForeground(): boolean {
  if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) return false;
  // Native initial state can be unknown until its bridge response arrives.
  return AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
}

export function startForegroundPolling(
  work: (current: () => boolean) => Promise<void>,
  interval: number | (() => number),
): () => void {
  let alive = true;
  let foreground = isAppForeground();
  let running = false;
  let rerun = false;
  let epoch = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const run = async () => {
    if (!alive || !foreground) return;
    if (running) {
      rerun = true;
      return;
    }
    clear();
    running = true;
    rerun = false;
    const generation = epoch;
    const startedAt = Date.now();
    try {
      await work(() => alive && foreground && generation === epoch);
    } catch {
      // Product callbacks own their feedback; an unexpected failure cannot stop polling.
    } finally {
      running = false;
      if (alive && foreground) {
        const period = typeof interval === 'function' ? interval() : interval;
        timer = setTimeout(
          () => void run(),
          rerun ? 0 : Math.max(500, period - (Date.now() - startedAt)),
        );
      }
    }
  };
  const onForegroundChange = () => {
    epoch++;
    foreground = isAppForeground();
    clear();
    if (foreground) void run();
  };
  const subscription = AppState.addEventListener('change', onForegroundChange);
  const browser = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
  browser?.addEventListener('visibilitychange', onForegroundChange);
  void run();
  return () => {
    alive = false;
    epoch++;
    clear();
    subscription.remove();
    browser?.removeEventListener('visibilitychange', onForegroundChange);
  };
}
