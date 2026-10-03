import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { googleServerCode, googleSignInConfigured } from './googleSignIn';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
}));

describe('native Google Sign-In adapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = '123-abc.apps.googleusercontent.com';
    (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  });

  it('requests a server code without putting a client secret in the app', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
      type: 'success',
      data: { serverAuthCode: 'server-code' },
    });
    expect(await googleServerCode()).toBe('server-code');
    expect(GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({ webClientId: 'web-client-id', offlineAccess: true }),
    );
  });

  it('does not yield a code after cancellation', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled' });
    expect(await googleServerCode()).toBeNull();
  });

  it('does not start the provider without a Web client ID', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    expect(googleSignInConfigured()).toBe(false);
    await expect(googleServerCode()).rejects.toThrow('not configured');
    expect(GoogleSignin.signIn).not.toHaveBeenCalled();
  });
});
