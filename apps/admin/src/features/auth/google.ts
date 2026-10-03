type GoogleCodeResponse = { code?: string; error?: string };
type GoogleWindow = Window & {
  google?: {
    accounts: {
      oauth2: {
        initCodeClient(options: {
          client_id: string;
          scope: string;
          ux_mode: 'popup';
          callback: (value: GoogleCodeResponse) => void;
          error_callback: (value: { type: string }) => void;
        }): { requestCode(): void };
      };
    };
  };
};

let scriptPromise: Promise<void> | null = null;
export function googleConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID);
}
export async function requestGoogleCode(): Promise<string | null> {
  const clientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) throw new Error('Google 登录尚未配置');
  const googleWindow = window as GoogleWindow;
  if (!googleWindow.google) {
    scriptPromise ??= new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () =>
        googleWindow.google ? resolve() : reject(new Error('Google 登录脚本不可用'));
      script.onerror = () => reject(new Error('Google 登录脚本加载失败'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      scriptPromise = null;
      throw error;
    });
    await scriptPromise;
  }
  const google = googleWindow.google;
  if (!google) throw new Error('Google 登录脚本不可用');
  return new Promise<string | null>((resolve, reject) => {
    google.accounts.oauth2
      .initCodeClient({
        client_id: clientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        callback: (value) =>
          value.code ? resolve(value.code) : reject(new Error(value.error ?? '未取得授权码')),
        error_callback: (value) =>
          value.type === 'popup_closed' ? resolve(null) : reject(new Error(value.type)),
      })
      .requestCode();
  });
}
