import { AudioSession, registerGlobals } from '@livekit/react-native';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { mediaDevices } from '@livekit/react-native-webrtc';
import { MicrophoneProbeCache } from '../../services/microphoneProbeCache';
import { probeMicrophone } from '../../services/voiceDeviceCheck';

import { LiveKitVoiceMedia } from './mediaCore';

const microphoneCache = new MicrophoneProbeCache();
let registered = false;
const audioOwners = new Set<symbol>();
let audioOperation: Promise<void> = Promise.resolve();

// AudioSession is process-wide. A departed room must not stop the next room's audio.
function updateAudioSession(owner: symbol, start: boolean): Promise<void> {
  const operation = audioOperation
    .catch(() => undefined)
    .then(async () => {
      if (start) {
        if (audioOwners.has(owner)) return;
        if (!audioOwners.size) await AudioSession.startAudioSession();
        audioOwners.add(owner);
      } else if (audioOwners.delete(owner) && !audioOwners.size) {
        await AudioSession.stopAudioSession();
      }
    });
  audioOperation = operation;
  return operation;
}

export function createVoiceMedia(): LiveKitVoiceMedia {
  const audioOwner = Symbol('voice-room-audio');
  if (!registered) {
    registerGlobals();
    registered = true;
  }
  return new LiveKitVoiceMedia({
    browserPlaybackPolicy: false,
    subscribeDeviceChanges(changed) {
      mediaDevices.addEventListener('devicechange', changed);
      return () => mediaDevices.removeEventListener('devicechange', changed);
    },
    start: () => updateAudioSession(audioOwner, true),
    stop: () => updateAudioSession(audioOwner, false),
    attachRemoteAudio() {},
    detachRemoteAudio() {},
    invalidateDeviceCheck: () => microphoneCache.invalidate(),
    async checkMicrophone(signal, force = false) {
      let permission = await getRecordingPermissionsAsync();
      if (
        !permission.granted &&
        permission.canAskAgain &&
        (force || permission.status === 'undetermined')
      )
        permission = await requestRecordingPermissionsAsync();
      if (signal.aborted) return 'unavailable';
      if (!permission.granted) {
        microphoneCache.invalidate();
        return permission.canAskAgain ? 'denied' : 'blocked';
      }
      return microphoneCache.check(true, force, signal, () =>
        probeMicrophone(() => mediaDevices.getUserMedia({ audio: true, video: false }), signal),
      );
    },
    async checkAudioOutput() {
      return (await AudioSession.getAudioOutputs()).length > 0;
    },
    async requestMicrophone() {
      let permission = await getRecordingPermissionsAsync();
      if (!permission.granted && permission.canAskAgain)
        permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error('MICROPHONE_UNAVAILABLE');
    },
  });
}
