import type { PrivateClip } from './privateClip.types';

export async function privateClipFromUri(uri: string): Promise<PrivateClip> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('PRIVATE_AUDIO_UNAVAILABLE');
  const source = await response.blob();
  const mimeType = source.type.split(';')[0] || 'audio/webm';
  const blob = new Blob([source], { type: mimeType });
  return {
    uri,
    name: mimeType === 'audio/webm' ? 'expression.webm' : 'expression.m4a',
    mimeType,
    formFile: blob,
    size: blob.size,
    release: () => URL.revokeObjectURL(uri),
  };
}
