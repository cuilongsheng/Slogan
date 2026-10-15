import { createSloganApiClient } from '@slogan/api-client';
import { observeMobileFetch } from '../services/observability';
import { rememberMobileRequest, traceMobileFetch } from '../services/observability/tracing';

export function createMobileApiClient(baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL) {
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set before making API requests.');
  }

  return createSloganApiClient({
    baseUrl,
    onRequest: rememberMobileRequest,
    fetch: (input, init) =>
      traceMobileFetch(
        input,
        init,
        (tracedInput, tracedInit) =>
          observeMobileFetch(() => fetch(tracedInput, { ...tracedInit, credentials: 'include' })),
        baseUrl,
      ),
  });
}
