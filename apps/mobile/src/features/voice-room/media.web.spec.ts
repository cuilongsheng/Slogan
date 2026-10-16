import { createVoiceMedia } from './media.web';

const capture = jest.fn(async () => ({
  getAudioTracks: () => [{ readyState: 'live' }],
  getTracks: () => [{ stop: jest.fn() }],
}));
let permission: 'granted' | 'denied' = 'granted';
jest.mock('livekit-client', () => ({
  Room: jest.fn(() => ({
    canPlaybackAudio: true,
    localParticipant: {
      identity: 'self',
      isMicrophoneEnabled: false,
      audioTrackPublications: new Map(),
    },
    remoteParticipants: new Map(),
    on: jest.fn(),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
    removeAllListeners: jest.fn(),
    startAudio: jest.fn(async () => {}),
  })),
  RoomEvent: {},
  Track: { Kind: { Audio: 'audio' } },
}));

test('a second web room reuses granted microphone capability but revocation cannot reuse it', async () => {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        getUserMedia: capture,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
      permissions: {
        query: async () => ({
          state: permission,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }),
      },
    },
  });
  const credential = { serverUrl: 'wss://fixture.invalid', participantToken: 'fixture' } as never;
  try {
    for (let index = 0; index < 2; index++) {
      const media = createVoiceMedia();
      await media.connect(credential);
      await media.checkDevices(false);
      expect(media.snapshot.deviceCheck?.microphone).toBe('ready');
      await media.disconnect();
    }
    expect(capture).toHaveBeenCalledTimes(1);
    permission = 'denied';
    const media = createVoiceMedia();
    await media.connect(credential);
    await media.checkDevices(false);
    expect(media.snapshot.deviceCheck?.microphone).toBe('denied');
    expect(capture).toHaveBeenCalledTimes(1);
    await media.disconnect();
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
