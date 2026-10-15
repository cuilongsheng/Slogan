import { createSloganApiClient } from '@slogan/api-client';
import { clearAdminObservability, observeAdminFetch } from '../app/observability';
import { rememberAdminRequest, traceAdminFetch } from '../app/tracing';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const browserClient = createSloganApiClient({
  baseUrl,
  onRequest: rememberAdminRequest,
  fetch: (input, init) =>
    traceAdminFetch(
      input,
      init,
      (tracedInput, tracedInit) =>
        observeAdminFetch(() => fetch(tracedInput, { ...tracedInit, credentials: 'include' })),
      baseUrl,
    ),
});

export function setAccessToken(token: string | null) {
  if (token === null) clearAdminObservability();
  accessToken = token;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { data } = await browserClient.POST('/v1/auth/web/refresh');
        accessToken = data?.accessToken ?? null;
        return accessToken;
      } catch {
        accessToken = null;
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export const adminApi = createSloganApiClient({
  baseUrl,
  onRequest: rememberAdminRequest,
  fetch: (input, init) =>
    traceAdminFetch(
      input,
      init,
      async (input, init) => {
        const request = new Request(input, init);
        const headers = new Headers(request.headers);
        if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
        const isProtected = new URL(request.url).pathname.startsWith('/v1/backoffice');
        const response = await observeAdminFetch(async () => {
          let response = await fetch(request, { credentials: 'include', headers });
          if (response.status === 401 && !request.url.includes('/v1/auth/')) {
            const token = await refreshAccessToken();
            if (token) {
              headers.set('Authorization', `Bearer ${token}`);
              response = await fetch(request, { credentials: 'include', headers });
            }
          }
          return response;
        }, isProtected);
        return response;
      },
      baseUrl,
    ),
});

export async function exchangePassword(username: string, password: string) {
  return browserClient.POST('/v1/auth/web/password/exchange', {
    body: { username, password, deviceName: 'Slogan Admin Browser' },
  });
}

export async function exchangeGoogle(authorizationCode: string) {
  return browserClient.POST('/v1/auth/web/google/exchange', {
    body: { authorizationCode, redirectUri: window.location.origin },
  });
}

export async function logoutBrowser() {
  try {
    await browserClient.POST('/v1/auth/web/logout');
  } finally {
    accessToken = null;
    clearAdminObservability();
  }
}

export function apiError(response: Response, error?: { code?: string; message?: string }) {
  if (response.status === 403) return new Error('BACKOFFICE_ACCESS_DENIED');
  if (response.status === 401) return new Error('SESSION_EXPIRED');
  return new Error(error?.message || error?.code || `HTTP_${response.status}`);
}
