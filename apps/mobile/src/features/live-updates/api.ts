import { createSloganApiClient, type SloganApiPaths } from '@slogan/api-client';
import type { useAuth } from '../auth';
type AuthorizedRequest = ReturnType<typeof useAuth>['authorized'];
import { streamFetch } from '../../services/streamFetch';
import { EventStreamParser } from './parser';

export type LiveEvent =
  SloganApiPaths['/v1/me/live-updates']['get']['responses'][200]['content']['text/event-stream'];
export async function receiveLiveUpdates(
  authorized: AuthorizedRequest,
  signal: AbortSignal,
  cursor: string | undefined,
  onEvent: (event: LiveEvent, id: string) => void,
) {
  const client = createSloganApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL!,
    fetch: streamFetch,
  });
  const result = await authorized((token) =>
    client.GET('/v1/me/live-updates', {
      headers: { Authorization: `Bearer ${token}`, ...(cursor ? { 'Last-Event-ID': cursor } : {}) },
      parseAs: 'stream',
      signal,
    }),
  );
  if (
    !result.response.ok ||
    !result.response.headers.get('content-type')?.startsWith('text/event-stream') ||
    !result.data
  )
    throw new Error('Live updates unavailable');
  const reader = result.data.getReader();
  const decoder = new TextDecoder();
  const parser = new EventStreamParser((value, id) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('scope' in value) ||
      !['reset', 'rooms', 'partners', 'messages', 'heartbeat', 'renew'].includes(
        String(value.scope),
      )
    )
      throw new Error('Live event unavailable');
    onEvent(value as LiveEvent, id);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void reader.cancel().catch(() => undefined);
    }, 30000);
  };
  const abort = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    watchdog();
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      watchdog();
      parser.push(decoder.decode(chunk.value, { stream: true }));
    }
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
