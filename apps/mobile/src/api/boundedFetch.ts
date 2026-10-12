/** Bound transport waits without overriding cancellation supplied by callers. */
export const boundedFetch: typeof globalThis.fetch = async (input, init) => {
  const source =
    init?.signal ??
    (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (source?.aborted) abort();
  else source?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 30_000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Include response-body reading in the timeout, rather than stopping at response headers.
    // Native fetch already decodes UTF-8. Rewrapping bytes makes the RN Response
    // polyfill interpret each byte as a character, corrupting non-ASCII JSON.
    const body = await response.text();
    return new Response(body.length ? body : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } finally {
    clearTimeout(timeout);
    source?.removeEventListener('abort', abort);
  }
};
