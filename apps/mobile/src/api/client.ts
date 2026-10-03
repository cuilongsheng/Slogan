import { createSloganApiClient } from '@slogan/api-client';

export function createMobileApiClient(baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL) {
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set before making API requests.');
  }

  return createSloganApiClient({ baseUrl });
}
