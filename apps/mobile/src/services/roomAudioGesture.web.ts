import type { RoomOptions } from 'livekit-client';

let context: AudioContext | undefined;
const resumeRooms = new Set<() => Promise<void>>();

function audioContext(): AudioContext | undefined {
  if (context && context.state !== 'closed') return context;
  try {
    if (typeof AudioContext !== 'undefined') context = new AudioContext();
  } catch {
    // A real playback failure is still reported by the SDK, never hidden here.
  }
  return context;
}

export function roomAudioOptions(): Pick<RoomOptions, 'webAudioMix'> {
  const current = audioContext();
  return current ? { webAudioMix: { audioContext: current } } : {};
}

export function roomAudioCanPlay(): boolean {
  return context ? context.state === 'running' : true;
}

export function bindRoomAudio(resume: () => Promise<void>, changed: () => void): () => void {
  resumeRooms.add(resume);
  const current = audioContext();
  current?.addEventListener('statechange', changed);
  return () => {
    resumeRooms.delete(resume);
    current?.removeEventListener('statechange', changed);
  };
}

// Capture the actual gesture before navigation or an awaited admission request.
// A custom context survives room navigation; SDK tracks and listeners do not.
export function installRoomAudioGestures(): () => void {
  const activate = () => {
    const current = audioContext();
    if (current?.state === 'suspended') void current.resume().catch(() => undefined);
    resumeRooms.forEach((resume) => void resume().catch(() => undefined));
  };
  document.addEventListener('pointerdown', activate, true);
  document.addEventListener('keydown', activate, true);
  return () => {
    document.removeEventListener('pointerdown', activate, true);
    document.removeEventListener('keydown', activate, true);
  };
}
