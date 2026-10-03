import type { PrivateClip } from './privateClip.types';

export async function privateClipFromUri(uri: string): Promise<PrivateClip> {
  // React Native's FormData accepts a file descriptor at runtime.
  const file = { uri, name: 'expression.m4a', type: 'audio/mp4' } as unknown as Blob;
  return { uri, name: 'expression.m4a', mimeType: 'audio/mp4', formFile: file, size: null, release() {} };
}
