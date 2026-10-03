import { Platform } from 'react-native';
import Constants from 'expo-constants';

function nativeGoogle() {
  // The package reads its native module at import time, so load it only when sign-in is requested.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
  return require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
}

function config() {
  return {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  };
}

export function googleSignInConfigured(): boolean {
  const { webClientId, iosClientId } = config();
  return Boolean(
    Platform.OS !== 'web' &&
    Constants.appOwnership !== 'expo' &&
    webClientId &&
    (Platform.OS !== 'ios' || /^[^.]+\.apps\.googleusercontent\.com$/.test(iosClientId)),
  );
}

export function googleSignInNeedsDevelopmentBuild(): boolean {
  return Platform.OS === 'web' || Constants.appOwnership === 'expo';
}

export function googleRedirectUri(): string {
  return 'slogan://oauth/google/native';
}

export async function prepareGoogleSignIn(): Promise<void> {
  // The native SDK is loaded only after the user starts sign-in.
}

export async function googleServerCode(): Promise<string | null> {
  if (!googleSignInConfigured()) throw new Error('Google Sign-In is not configured');
  const { GoogleSignin, isSuccessResponse } = nativeGoogle();
  const { webClientId, iosClientId } = config();
  GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === 'ios' ? { iosClientId } : {}),
    offlineAccess: true,
  });
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return null;
  if (!response.data.serverAuthCode)
    throw new Error('Google did not return a server authorization code');
  return response.data.serverAuthCode;
}

export async function googleSignOut(): Promise<void> {
  const { GoogleSignin } = nativeGoogle();
  await GoogleSignin.signOut();
}
