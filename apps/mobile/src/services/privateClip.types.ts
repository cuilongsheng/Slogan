export interface PrivateClip {
  uri: string;
  name: string;
  mimeType: string;
  formFile: Blob;
  size: number | null;
  release(): void;
}
