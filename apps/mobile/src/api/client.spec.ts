import { createMobileApiClient } from './client';

describe('mobile API client configuration', () => {
  it('does not use an implicit localhost API address', () => {
    expect(() => createMobileApiClient('')).toThrow('EXPO_PUBLIC_API_BASE_URL');
  });

  it('accepts an explicitly configured device-reachable address', () => {
    expect(createMobileApiClient('https://api.example.test')).toBeDefined();
  });
});
