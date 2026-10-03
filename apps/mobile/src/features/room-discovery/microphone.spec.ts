import { checkWebMicrophone, microphonePermissionStatus } from './microphone';

jest.mock('expo-audio', () => ({
  AudioModule: {},
  RecordingPresets: {},
  requestRecordingPermissionsAsync: jest.fn(),
}));

describe('web microphone check', () => {
  it('requires an available device and releases tracks after probing', async () => {
    const stop = jest.fn();
    const mediaDevices = {
      getUserMedia: jest.fn(async () => ({
        getAudioTracks: () => [{ readyState: 'live' }],
        getTracks: () => [{ stop }],
      })),
    } as unknown as MediaDevices;
    expect(await checkWebMicrophone(mediaDevices)).toBe('ready');
    expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(await checkWebMicrophone()).toBe('unavailable');
  });

  it('distinguishes rejected permission from missing hardware', async () => {
    const denied = {
      getUserMedia: jest.fn(async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      }),
    } as unknown as MediaDevices;
    const missing = {
      getUserMedia: jest.fn(async () => {
        throw new DOMException('Missing', 'NotFoundError');
      }),
    } as unknown as MediaDevices;
    expect(await checkWebMicrophone(denied)).toBe('denied');
    expect(await checkWebMicrophone(missing)).toBe('unavailable');
  });
});

describe('native microphone permission', () => {
  it('separates retryable denial from a blocked system permission', () => {
    expect(microphonePermissionStatus({ granted: true, canAskAgain: false })).toBe('ready');
    expect(microphonePermissionStatus({ granted: false, canAskAgain: true })).toBe('denied');
    expect(microphonePermissionStatus({ granted: false, canAskAgain: false })).toBe('blocked');
  });
});
