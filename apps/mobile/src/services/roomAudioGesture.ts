// Native audio readiness is owned by the LiveKit AudioSession adapter.
export function installRoomAudioGestures(): () => void {
  return () => undefined;
}
