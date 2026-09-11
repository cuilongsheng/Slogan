import { AuthError } from '../../modules/auth/index.js';

export async function fetchJson(
  url: string | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AuthError('AUTH_PROVIDER_TIMEOUT', 'OAuth provider request timed out');
    }
    throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 'OAuth provider is unavailable');
  }

  try {
    if (response.status === 429 || response.status >= 500) {
      throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 'OAuth provider is unavailable');
    }
    const body: unknown = await response.json();
    if (!response.ok || typeof body !== 'object' || body === null) {
      throw new AuthError('AUTH_CODE_REJECTED', 'OAuth provider rejected the authorization code');
    }
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError('AUTH_CODE_REJECTED', 'OAuth provider response was invalid');
  }
}

export function requireAllowedRedirect(redirectUri: string, configured: string | undefined): void {
  const allowed = (configured ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowed.includes(redirectUri)) {
    throw new AuthError('AUTH_CODE_REJECTED', 'OAuth redirect URI is not allowed');
  }
}
