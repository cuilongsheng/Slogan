import type { DirectCall } from './api';
export function mergeCall(previous: DirectCall | null, next: DirectCall): DirectCall {
  const rank = (status: string) => (status === 'RINGING' ? 0 : status === 'ACTIVE' ? 1 : 2);
  if (previous && previous.id === next.id && rank(previous.status) > rank(next.status))
    return previous;
  const peer = next.peer ?? previous?.peer;
  return { ...next, ...(peer ? { peer } : {}) };
}
