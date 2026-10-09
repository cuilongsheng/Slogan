import type { RemoteTrack } from 'livekit-client';

import { LiveKitVoiceMedia } from './mediaCore';
import { probeMicrophone } from '../../services/voiceDeviceCheck';

export function createVoiceMedia(): LiveKitVoiceMedia {
  const attached = new Map<RemoteTrack, HTMLMediaElement[]>();
  return new LiveKitVoiceMedia({
    async start() {},
    async checkMicrophone(signal) {
      if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
      return probeMicrophone(
        () => navigator.mediaDevices.getUserMedia({ audio: true, video: false }),
        signal,
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
