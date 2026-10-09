import { AudioSession } from '@livekit/react-native';
import { mediaDevices } from '@livekit/react-native-webrtc';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { createVoiceMedia } from './media';

const mockTrackStop = jest.fn();
const mockStreamRelease = jest.fn();
jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AudioSession: {
    startAudioSession: jest.fn(async () => {}),
    stopAudioSession: jest.fn(async () => {}),
    getAudioOutputs: jest.fn(async () => ['speaker']),
  },
}));
jest.mock('@livekit/react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: jest.fn(async () => ({
      getAudioTracks: () => [{ readyState: 'live', stop: mockTrackStop }],
      getTracks: () => [{ readyState: 'live', stop: mockTrackStop }],
      release: mockStreamRelease,
    })),
  },
}));
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
}));
jest.mock('livekit-client', () => ({
  Room: jest.fn(() => ({
    localParticipant: { identity: 'self', isSpeaking: false, isMicrophoneEnabled: false },
    remoteParticipants: new Map(),
    on: jest.fn(),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
  })),
  RoomEvent: {},
  Track: { Kind: { Audio: 'audio' } },
}));
const credential = { serverUrl: 'wss://fixture.invalid', participantToken: 'fixture' } as never;
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(requestRecordingPermissionsAsync)
    .mockResolvedValue({ granted: true, canAskAgain: true } as never);
  jest.mocked(AudioSession.startAudioSession).mockResolvedValue();
  jest.mocked(AudioSession.getAudioOutputs).mockResolvedValue(['speaker']);
});

test('native admission probes a real adapter input, releases its stream, and remains muted', async () => {
  const media = createVoiceMedia();
  await media.connect(credential);
  await media.checkDevices();
  expect(mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  expect(mockTrackStop).toHaveBeenCalledTimes(1);
  expect(mockStreamRelease).toHaveBeenCalledTimes(1);
  expect(media.snapshot).toMatchObject({
    microphoneEnabled: false,
    deviceCheck: { microphone: 'ready', playback: 'ready' },
  });
  await media.disconnect();
});
test('permanent permission denial skips capture and a missing output is reported separately', async () => {
  jest
    .mocked(requestRecordingPermissionsAsync)
    .mockResolvedValue({ granted: false, canAskAgain: false } as never);
  jest.mocked(AudioSession.getAudioOutputs).mockResolvedValue([]);
  const media = createVoiceMedia();
  await media.connect(credential);
  await media.checkDevices();
  expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(media.snapshot).toMatchObject({
    connection: 'connected',
    microphoneEnabled: false,
    deviceCheck: { microphone: 'blocked', playback: 'unavailable' },
  });
  await media.disconnect();
});
test('the departed room cannot stop process-wide audio still used by the next room', async () => {
  const previous = createVoiceMedia();
  const next = createVoiceMedia();
  await previous.connect(credential);
  await previous.checkDevices();
  await next.connect(credential);
  await next.checkDevices();
  expect(AudioSession.startAudioSession).toHaveBeenCalledTimes(1);
  await previous.disconnect();
  expect(AudioSession.stopAudioSession).not.toHaveBeenCalled();
  await next.disconnect();
  expect(AudioSession.stopAudioSession).toHaveBeenCalledTimes(1);
});
test('audio session startup failure leaves muted/text admission available and reports an output problem', async () => {
  jest.mocked(AudioSession.startAudioSession).mockRejectedValue(new Error('audio unavailable'));
  const media = createVoiceMedia();
  await media.connect(credential);
  await media.checkDevices();
  expect(media.snapshot).toMatchObject({
    connection: 'connected',
    microphoneEnabled: false,
    deviceCheck: { playback: 'unavailable' },
  });
  await media.disconnect();
});
