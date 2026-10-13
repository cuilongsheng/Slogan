import type { RemoteTrack } from 'livekit-client';

import { LiveKitVoiceMedia } from './mediaCore';
import { MicrophoneProbeCache } from '../../services/microphoneProbeCache';
import {
  bindRoomAudio,
  roomAudioOptions,
  roomAudioCanPlay,
} from '../../services/roomAudioGesture.web';
import { probeMicrophone } from '../../services/voiceDeviceCheck';

const microphoneCache = new MicrophoneProbeCache();

export function createVoiceMedia(): LiveKitVoiceMedia {
  const attached = new Map<RemoteTrack, HTMLMediaElement[]>();
  let notifyDeviceChange: (() => void) | undefined;
  let permissionStatus: PermissionStatus | undefined;
  const changed = () => {
    microphoneCache.invalidate();
    notifyDeviceChange?.();
  };
  return new LiveKitVoiceMedia({
    roomOptions: roomAudioOptions,
    audioPlaybackAllowed: roomAudioCanPlay,
    bindAudioPlayback: bindRoomAudio,
    invalidateDeviceCheck: () => microphoneCache.invalidate(),
    subscribeDeviceChanges(listener) {
      notifyDeviceChange = listener;
      navigator.mediaDevices?.addEventListener('devicechange', changed);
      return () => {
        notifyDeviceChange = undefined;
        navigator.mediaDevices?.removeEventListener('devicechange', changed);
        permissionStatus?.removeEventListener('change', changed);
      };
    },
    async start() {},
    async checkMicrophone(signal, force = false) {
      if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
      const permission = await navigator.permissions
        ?.query({ name: 'microphone' as PermissionName })
        .catch(() => undefined);
      if (signal.aborted) return 'unavailable';
      permissionStatus?.removeEventListener('change', changed);
      permissionStatus = permission;
      permissionStatus?.addEventListener('change', changed);
      if (permission?.state === 'denied') {
        microphoneCache.invalidate();
        return 'denied';
      }
      return microphoneCache.check(permission?.state === 'granted', force, signal, () =>
        probeMicrophone(
          () => navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
          signal,
        ),
      );
    },
    async checkAudioOutput() {
      // canPlaybackAudio supplies the actual browser autoplay state separately.
      return typeof HTMLAudioElement !== 'undefined';
    },
    async stop() {
      attached.forEach((elements) => elements.forEach((element) => element.remove()));
      attached.clear();
    },
    attachRemoteAudio(track) {
      const element = track.attach();
      element.autoplay = true;
      element.style.display = 'none';
      document.body.appendChild(element);
      attached.set(track, [element]);
    },
    detachRemoteAudio(track) {
      track.detach().forEach((element) => element.remove());
      attached.delete(track);
    },
  });
}
