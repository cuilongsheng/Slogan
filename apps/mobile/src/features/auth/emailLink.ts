import * as Linking from 'expo-linking';

// useLinkingURL covers both cold starts and links delivered while the app is running.
export function useEmailLinkToken(purpose: 'REGISTER' | 'RESET_PASSWORD'): string | null {
  const url = Linking.useLinkingURL();
  if (!url) return null;
  const params = new URLSearchParams(url.split('#')[1] ?? '');
  const token = params.get('token');
  return params.get('purpose') === purpose && token && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? token
    : null;
}
