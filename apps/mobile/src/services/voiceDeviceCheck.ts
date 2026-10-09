export type MicrophoneCheck = 'checking' | 'ready' | 'denied' | 'blocked' | 'unavailable';
export type PlaybackCheck = 'checking' | 'ready' | 'unavailable';

type ProbeTrack = { readyState: string; stop(): void };
type ProbeStream = {
  getAudioTracks(): ProbeTrack[];
  getTracks(): ProbeTrack[];
  release?(): void;
};

// Probe only: this stream is never recorded, attached to a room, or uploaded.
export async function probeMicrophone(
  capture: () => Promise<ProbeStream>,
  signal: AbortSignal,
): Promise<MicrophoneCheck> {
  let stream: ProbeStream | undefined;
  try {
    if (signal.aborted) return 'unavailable';
    stream = await capture();
    if (signal.aborted) return 'unavailable';
    return stream.getAudioTracks().some((track) => track.readyState === 'live')
      ? 'ready'
      : 'unavailable';
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)
      ? 'denied'
      : 'unavailable';
  } finally {
    try {
      stream?.getTracks().forEach((track) => track.stop());
    } finally {
      // React Native WebRTC stop() disables the track; release() frees native tracks/stream.
      stream?.release?.();
    }
  }
}
