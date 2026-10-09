import { AudioSession, registerGlobals } from '@livekit/react-native';
import { requestRecordingPermissionsAsync } from 'expo-audio';

import { LiveKitVoiceMedia } from './mediaCore';

let registered = false;

export function createVoiceMedia(): LiveKitVoiceMedia {
  if (!registered) {
    registerGlobals();
    registered = true;
  }
  return new LiveKitVoiceMedia({
    start: () => AudioSession.startAudioSession(),
    stop: () => AudioSession.stopAudioSession(),
    attachRemoteAudio() {},
    detachRemoteAudio() {},
    async requestMicrophone() {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('MICROPHONE_UNAVAILABLE');
    },
  });
}
