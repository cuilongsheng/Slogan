export interface AndroidRelease {
  commit: string;
  version: string;
  versionCode: number;
  bytes: number;
  sha256: string;
  package: string;
  certificateSha256: string;
  abi: string[];
}

export interface UpdateCheck {
  installedVersion: string;
  installedVersionCode: number;
  release: AndroidRelease | null;
}

export interface AppUpdateService {
  supported: boolean;
  check(): Promise<UpdateCheck>;
  download(release: AndroidRelease): Promise<void>;
  cancel(): void;
  canInstall(): boolean;
  openSettings(): Promise<void>;
  install(): Promise<void>;
  onProgress(listener: (progress: { bytes: number; total: number }) => void): () => void;
}
