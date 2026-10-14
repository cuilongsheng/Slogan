import { NativeModule, requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import type { AndroidRelease, AppUpdateService } from './types';

declare class UpdaterModule extends NativeModule<{
  progress: (progress: { bytes: number; total: number }) => void;
}> {
  check(): Promise<{
    installedVersion: string;
    installedVersionCode: number;
    release: string | null;
  }>;
  download(release: string): Promise<void>;
  cancel(): void;
  canInstall(): boolean;
  openSettings(): Promise<void>;
  install(): Promise<void>;
}
const native = requireOptionalNativeModule<UpdaterModule>('SloganUpdater');
function module(): UpdaterModule {
  if (!native) throw new Error('UPDATES_UNSUPPORTED');
  return native;
}
export const appUpdates: AppUpdateService = {
  supported: !!native && !!Constants.expoConfig?.extra?.release?.commit,
  async check() {
    const result = await module().check();
    return {
      ...result,
      // Native has already validated the release artifact, identity and ABI.
      release: result.release ? (JSON.parse(result.release) as AndroidRelease) : null,
    };
  },
  download: (release) => module().download(JSON.stringify(release)),
  cancel: () => native?.cancel(),
  canInstall: () => module().canInstall(),
  openSettings: () => module().openSettings(),
  install: () => module().install(),
  onProgress: (listener) => {
    const subscription = module().addListener('progress', listener);
    return () => subscription.remove();
  },
};
