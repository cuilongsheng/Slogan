// Copied verbatim into each Pages output as the advanced-mode _worker.js.
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

export function isApiPath(pathname) {
  return pathname === '/v1' || pathname.startsWith('/v1/');
}

function upstreamOrigin(value) {
  if (typeof value !== 'string') throw new Error('Invalid configuration');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !(
      url.hostname === 'slogan-api-pi.vercel.app' ||
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.onrender\.com$/.test(url.hostname)
    )
  )
    throw new Error('Invalid configuration');
  return url.origin;
}

function cleanHeaders(source) {
  const headers = new Headers(source);
  for (const name of (headers.get('connection') ?? '').split(',')) {
    if (name.trim()) headers.delete(name.trim());
  }
  for (const name of HOP_BY_HOP) headers.delete(name);
  return headers;
}

function failure(status, code) {
  return Response.json(
    { code, message: 'API temporarily unavailable' },
    {
      status,
      headers: { 'cache-control': 'private, no-store', 'retry-after': '5' },
    },
  );
}

// Injection is for isolated protocol/browser tests; deployment uses global fetch.
export function createApiProxy({ fetchUpstream = fetch, timeoutMs = 90_000 } = {}) {
  return {
    async fetch(request, env) {
      const incoming = new URL(request.url);
      if (!isApiPath(incoming.pathname)) return env.ASSETS.fetch(request);
      let origin;
      try {
        origin = upstreamOrigin(env.API_UPSTREAM_ORIGIN);
      } catch {
        return failure(503, 'API_PROXY_CONFIGURATION_INVALID');
      }

      const headers = cleanHeaders(request.headers);
      for (const name of [...headers.keys()]) {
        if (
          /^(host|content-length|forwarded|via|x-forwarded-.*|cf-.*|true-client-ip|x-real-ip|x-original-url|x-rewrite-url)$/i.test(
            name,
          )
        ) {
          headers.delete(name);
        }
      }
      headers.set('cache-control', 'no-store');
      const controller = new AbortController();
      let timedOut = false;
      const cancel = () => controller.abort();
      if (request.signal.aborted) cancel();
      request.signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const target = `${origin}${incoming.pathname}${incoming.search}`;
        const upstream = await fetchUpstream(target, {
          method: request.method,
          headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          duplex: 'half',
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
        });
        // Hosting providers may serve an HTML availability page before Nest can respond.
        if (/^text\/html(?:\s*;|$)/i.test(upstream.headers.get('content-type') ?? '')) {
          controller.abort();
          return failure(
            upstream.status >= 500 ? upstream.status : 502,
            'API_PROXY_UPSTREAM_UNAVAILABLE',
          );
        }
        const responseHeaders = cleanHeaders(upstream.headers);
        const cookies =
          typeof upstream.headers.getAll === 'function'
            ? upstream.headers.getAll('Set-Cookie')
            : upstream.headers.getSetCookie();
        responseHeaders.delete('set-cookie');
        for (const cookie of cookies) {
          // The API uses host-only cookies. A Domain silently breaks Pages auth.
          if (/;\s*domain\s*=/i.test(cookie)) throw new Error('Invalid cookie scope');
          responseHeaders.append('set-cookie', cookie);
        }
        const location = responseHeaders.get('location');
        if (location) {
          const redirect = new URL(location, target);
          if (
            ![origin, incoming.origin].includes(redirect.origin) ||
            redirect.username ||
            redirect.password ||
            !isApiPath(redirect.pathname)
          )
            throw new Error('Unsafe redirect');
          responseHeaders.set(
            'location',
            `${incoming.origin}${redirect.pathname}${redirect.search}${redirect.hash}`,
          );
        }
        responseHeaders.set('cache-control', 'private, no-store');
        responseHeaders.set('cdn-cache-control', 'no-store');
        responseHeaders.set('cloudflare-cdn-cache-control', 'no-store');
        for (const name of ['etag', 'last-modified', 'expires', 'age'])
          responseHeaders.delete(name);
        return new Response(
          request.method === 'HEAD' || [204, 205, 304].includes(upstream.status)
            ? null
            : upstream.body,
          {
            status: upstream.status,
            statusText: upstream.statusText,
            headers: responseHeaders,
          },
        );
      } catch {
        controller.abort();
        return failure(
          timedOut ? 504 : 502,
          timedOut ? 'API_PROXY_TIMEOUT' : 'API_PROXY_UPSTREAM_UNAVAILABLE',
        );
      } finally {
        clearTimeout(timer);
        request.signal.removeEventListener('abort', cancel);
      }
    },
  };
}

export default createApiProxy();
