import type { AppUpdateService } from './types';

// Web/iOS never import the Android native module or fetch APK metadata.
const unavailable = () => Promise.reject(new Error('UPDATES_UNSUPPORTED'));
export const appUpdates: AppUpdateService = {
  supported: false,
  check: unavailable,
  download: unavailable,
  cancel: () => undefined,
  canInstall: () => false,
  openSettings: unavailable,
  install: unavailable,
  onProgress: () => () => undefined,
};
