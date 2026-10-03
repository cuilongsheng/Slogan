import { googleRedirectUri, googleServerCode, googleSignInConfigured } from './googleSignIn.web';

describe('web Google code popup', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'http://localhost:8082' },
    });
  });

  afterEach(() => {
    delete window.google;
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  });

  it('uses the browser origin and returns a one-time authorization code', async () => {
    const initCodeClient = jest.fn((options) => ({
      requestCode: () => options.callback({ code: 'web-code' }),
    }));
    window.google = { accounts: { oauth2: { initCodeClient } } };

    expect(googleSignInConfigured()).toBe(true);
    expect(googleRedirectUri()).toBe(window.location.origin);
    await expect(googleServerCode()).resolves.toBe('web-code');
    expect(initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'web-client-id', ux_mode: 'popup' }),
    );
  });

  it('does not create a code when the popup is closed', async () => {
    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: (options) => ({
            requestCode: () => options.error_callback({ type: 'popup_closed' }),
          }),
        },
      },
    };
    await expect(googleServerCode()).resolves.toBeNull();
  });
});
