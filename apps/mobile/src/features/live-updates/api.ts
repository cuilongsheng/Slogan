import { createSloganApiClient } from '@slogan/api-client';
import type { useAuth } from '../auth';
type AuthorizedRequest = ReturnType<typeof useAuth>['authorized'];
import { streamFetch } from '../../services/streamFetch';
import { EventStreamParser, liveEnvelope, type LiveEvent } from './parser';

export type { LiveEvent } from './parser';
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
  const transport = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = () => {
    transport.abort();
    void reader?.cancel().catch(() => undefined);
  };
  const watchdog = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(abort, 30000);
  };
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  try {
    watchdog();
    const result = await authorized((token) =>
      client.GET('/v1/me/live-updates', {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(cursor ? { 'Last-Event-ID': cursor } : {}),
        },
        params: { query: { protocol: 2 } },
        parseAs: 'stream',
        signal: transport.signal,
      }),
    );
    if (
      !result.response.ok ||
      !result.response.headers.get('content-type')?.startsWith('text/event-stream') ||
      !result.data
    )
      throw new Error('Live updates unavailable');
    reader = result.data.getReader();
    const decoder = new TextDecoder();
    const parser = new EventStreamParser((value, id) => {
      if (id.length > 512) throw new Error('Live cursor exceeds limit');
      onEvent(liveEnvelope(value), id);
    });
    watchdog();
    while (!transport.signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      watchdog();
      parser.push(decoder.decode(chunk.value, { stream: true }));
    }
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    // Cancelling an Expo body reader alone does not close its native HTTP request.
    transport.abort();
    await reader?.cancel().catch(() => undefined);
    reader?.releaseLock();
  }
}
