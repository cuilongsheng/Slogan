import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync } from 'expo-audio';
import { Platform } from 'react-native';

export type MicrophoneStatus = 'ready' | 'denied' | 'blocked' | 'unavailable';

export function microphonePermissionStatus(permission: {
  granted: boolean;
  canAskAgain: boolean;
}): 'ready' | 'denied' | 'blocked' {
  if (permission.granted) return 'ready';
  return permission.canAskAgain ? 'denied' : 'blocked';
}

export async function checkWebMicrophone(
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>,
): Promise<MicrophoneStatus> {
  if (!mediaDevices?.getUserMedia) return 'unavailable';
  let stream: MediaStream | null = null;
  try {
    stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    return stream.getAudioTracks().some((track) => track.readyState === 'live')
      ? 'ready'
      : 'unavailable';
  } catch (error) {
    return error instanceof DOMException &&
      (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')
      ? 'denied'
      : 'unavailable';
  } finally {
    stream?.getTracks().forEach((track) => track.stop());
  }
}

export async function checkMicrophone(): Promise<MicrophoneStatus> {
  if (Platform.OS === 'web') return checkWebMicrophone(globalThis.navigator?.mediaDevices);
  const permission = await requestRecordingPermissionsAsync();
  const permissionStatus = microphonePermissionStatus(permission);
  if (permissionStatus !== 'ready') return permissionStatus;
  let recorder: InstanceType<typeof AudioModule.AudioRecorder> | null = null;
  try {
    recorder = new AudioModule.AudioRecorder(RecordingPresets.LOW_QUALITY);
    await recorder.prepareToRecordAsync();
    return recorder.getAvailableInputs().length > 0 ? 'ready' : 'unavailable';
  } catch {
    return 'unavailable';
  } finally {
    await recorder?.stop().catch(() => undefined);
  }
}
