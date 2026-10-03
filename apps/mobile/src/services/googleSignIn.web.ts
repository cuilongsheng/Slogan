type CodeResponse = { code?: string; error?: string };
type CodeClient = { requestCode(): void };
type GoogleIdentity = {
  accounts: {
    oauth2: {
      initCodeClient(options: {
        client_id: string;
        scope: string;
        ux_mode: 'popup';
        callback(response: CodeResponse): void;
        error_callback(error: { type: string }): void;
      }): CodeClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let scriptPromise: Promise<void> | null = null;

export function googleSignInConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
}

export function googleSignInNeedsDevelopmentBuild(): boolean {
  return false;
}

export function googleRedirectUri(): string {
  return window.location.origin;
}

export function prepareGoogleSignIn(): Promise<void> {
  if (!googleSignInConfigured()) return Promise.resolve();
  if (window.google) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google ? resolve() : reject(new Error('Google script unavailable'));
    script.onerror = () => reject(new Error('Google script failed to load'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}

export async function googleServerCode(): Promise<string | null> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) throw new Error('Google Sign-In is not configured');
  await prepareGoogleSignIn();
  const google = window.google;
  if (!google) throw new Error('Google script unavailable');

  return new Promise<string | null>((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: (response) => {
        if (response.error || !response.code) {
          reject(new Error(response.error ?? 'Google did not return an authorization code'));
          return;
        }
        resolve(response.code);
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') resolve(null);
        else reject(new Error(error.type));
      },
    });
    client.requestCode();
  });
}

export async function googleSignOut(): Promise<void> {
  // The web code client has no local Google session to clear.
}
