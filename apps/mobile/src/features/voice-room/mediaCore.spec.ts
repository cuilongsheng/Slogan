import { Room } from 'livekit-client';

import { LiveKitVoiceMedia } from './mediaCore';

jest.mock('livekit-client', () => ({
  Room: jest.fn(),
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    ActiveSpeakersChanged: 'activeSpeakersChanged',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    Reconnecting: 'reconnecting',
    Reconnected: 'reconnected',
    Disconnected: 'disconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    DataReceived: 'dataReceived',
  },
  Track: { Kind: { Audio: 'audio' } },
}));

describe('LiveKit voice media', () => {
  it('connects muted and publishes microphone audio only after an explicit action', async () => {
    const localParticipant = {
      identity: 'self',
      isSpeaking: false,
      isMicrophoneEnabled: false,
      setMicrophoneEnabled: jest.fn(async (enabled: boolean) => {
        localParticipant.isMicrophoneEnabled = enabled;
      }),
    };
    const room = {
      localParticipant,
      remoteParticipants: new Map(),
      on: jest.fn(),
      connect: jest.fn(async () => undefined),
      disconnect: jest.fn(async () => undefined),
    };
    (Room as unknown as jest.Mock).mockImplementation(() => room);
    const platform = {
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
      attachRemoteAudio: jest.fn(),
      detachRemoteAudio: jest.fn(),
      requestMicrophone: jest.fn(async (): Promise<void> => undefined),
    };
    const media = new LiveKitVoiceMedia(platform);
    await media.connect({
      serverUrl: 'wss://example.invalid',
      participantToken: 'temporary',
    } as never);

    expect(room.connect).toHaveBeenCalledWith('wss://example.invalid', 'temporary', {
      autoSubscribe: true,
    });
    expect(media.snapshot.connection).toBe('connected');
    expect(media.snapshot.microphoneEnabled).toBe(false);
    expect(localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(platform.requestMicrophone).not.toHaveBeenCalled();

    platform.requestMicrophone.mockRejectedValueOnce(new Error('MICROPHONE_UNAVAILABLE'));
    await expect(media.setMicrophoneEnabled(true)).rejects.toThrow('MICROPHONE_UNAVAILABLE');
    expect(media.snapshot.microphoneEnabled).toBe(false);
    expect(localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();

    await media.setMicrophoneEnabled(true);
    expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(media.snapshot.microphoneEnabled).toBe(true);
    expect(platform.requestMicrophone).toHaveBeenCalledTimes(2);
    let allow!: () => void;
    platform.requestMicrophone.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          allow = resolve;
        }),
    );
    const enabling = media.setMicrophoneEnabled(true);
    await Promise.resolve(); // Permission has opened, but its answer is still pending.
    await media.disconnect();
    allow();
    await enabling;
    expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledTimes(1);
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(platform.stop).toHaveBeenCalledTimes(1);
  });

  it('notifies only for a matching safety alert packet from the active room', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const room = {
      localParticipant: { identity: 'self', isSpeaking: false, isMicrophoneEnabled: false },
      remoteParticipants: new Map(),
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) =>
        handlers.set(event, listener),
      ),
      connect: jest.fn(async () => undefined),
      disconnect: jest.fn(async () => undefined),
    };
    (Room as unknown as jest.Mock).mockImplementation(() => room);
    const media = new LiveKitVoiceMedia({
      start: jest.fn(async () => undefined),
      stop: jest.fn(async () => undefined),
      attachRemoteAudio: jest.fn(),
      detachRemoteAudio: jest.fn(),
    });
    const listener = jest.fn();
    media.subscribeSafetySignals(listener);
    await media.connect({
      roomId: 'room-1',
      serverUrl: 'wss://example.invalid',
      participantToken: 'temporary',
    } as never);
    const payload = new TextEncoder().encode(
      JSON.stringify({ version: 1, type: 'ROOM_SAFETY_ALERT', alert: { roomId: 'room-1' } }),
    );
    handlers.get('dataReceived')?.(payload, undefined, undefined, 'slogan.room-safety-alert.v1');
    expect(listener).toHaveBeenCalledTimes(1);
    handlers.get('dataReceived')?.(payload, undefined, undefined, 'other-topic');
    expect(listener).toHaveBeenCalledTimes(1);
    await media.disconnect();
    handlers.get('dataReceived')?.(payload, undefined, undefined, 'slogan.room-safety-alert.v1');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

function deviceFixture(
  checkMicrophone: (signal: AbortSignal) => Promise<'ready' | 'denied' | 'blocked' | 'unavailable'>,
) {
  const localParticipant = {
    identity: 'self',
    isSpeaking: false,
    isMicrophoneEnabled: false,
    setMicrophoneEnabled: jest.fn(async () => {}),
  };
  const room = {
    localParticipant,
    remoteParticipants: new Map(),
    on: jest.fn(),
    connect: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
  };
  (Room as unknown as jest.Mock).mockImplementation(() => room);
  const platform = {
    start: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    attachRemoteAudio: jest.fn(),
    detachRemoteAudio: jest.fn(),
    checkMicrophone: jest.fn(checkMicrophone),
    checkAudioOutput: jest.fn(async () => true),
    requestMicrophone: jest.fn(async () => {}),
  };
  return { room, platform, media: new LiveKitVoiceMedia(platform) };
}
const deviceCredential = {
  serverUrl: 'wss://example.invalid',
  participantToken: 'temporary',
} as never;
it.each(['denied', 'blocked', 'unavailable'] as const)(
  'automatically detects %s while admitting muted, then permits a device retry',
  async (status) => {
    const { media, room, platform } = deviceFixture(async () => status);
    platform.checkAudioOutput.mockResolvedValue(false);
    await media.connect(deviceCredential);
    await media.checkDevices();
    expect(media.snapshot).toMatchObject({
      connection: 'connected',
      microphoneEnabled: false,
      deviceCheck: { microphone: status, playback: 'unavailable' },
    });
    expect(platform.checkMicrophone).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    platform.checkMicrophone.mockResolvedValue('ready');
    platform.checkAudioOutput.mockResolvedValue(true);
    await media.checkDevices();
    expect(media.snapshot.deviceCheck).toEqual({ microphone: 'ready', playback: 'ready' });
    expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    await media.disconnect();
  },
);
it('a late probe after disconnect cannot update the room or open its microphone', async () => {
  let finish!: (status: 'ready') => void;
  const { media, room, platform } = deviceFixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await media.connect(deviceCredential);
  const checking = media.checkDevices();
  const enabling = media.setMicrophoneEnabled(true);
  const signal = platform.checkMicrophone.mock.calls[0]![0];
  await media.disconnect();
  expect(signal.aborted).toBe(true);
  finish('ready');
  await checking;
  await enabling;
  expect(media.snapshot.connection).toBe('disconnected');
  expect(media.snapshot.deviceCheck).toBeUndefined();
  expect(platform.requestMicrophone).not.toHaveBeenCalled();
  expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
});
it('publishing waits for the unpublished device probe to finish', async () => {
  let finish!: (status: 'ready') => void;
  const { media, room } = deviceFixture(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await media.connect(deviceCredential);
  const enabling = media.setMicrophoneEnabled(true);
  expect(room.localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  finish('ready');
  await enabling;
  expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  await media.disconnect();
});

it('exit during a pending LiveKit connection never starts a device probe or restores connected state', async () => {
  const { media, room, platform } = deviceFixture(async () => 'ready');
  let connected!: () => void;
  room.connect.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        connected = resolve;
      }),
  );
  const connecting = media.connect(deviceCredential);
  await Promise.resolve();
  await Promise.resolve();
  await media.disconnect();
  connected();
  await connecting;
  expect(media.snapshot.connection).toBe('disconnected');
  expect(platform.checkMicrophone).not.toHaveBeenCalled();
  expect(room.disconnect).toHaveBeenCalled();
});
