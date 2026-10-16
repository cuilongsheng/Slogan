import { Room } from 'livekit-client';

import { LiveKitVoiceMedia } from './mediaCore';
import { beginVoiceTrace } from '../../services/observability/tracing';
import { reportMobileError } from '../../services/observability';
jest.mock('../../services/observability', () => ({ reportMobileError: jest.fn() }));

jest.mock('../../services/observability/tracing', () => ({
  beginVoiceTrace: jest.fn(() => jest.fn()),
}));

jest.mock('livekit-client', () => ({
  Room: jest.fn(),
  DisconnectReason: {
    ROOM_DELETED: 1,
    PARTICIPANT_REMOVED: 2,
    DUPLICATE_IDENTITY: 3,
    CLIENT_INITIATED: 4,
  },
  RoomEvent: {
    ConnectionQualityChanged: 'qualityChanged',
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
    TrackSubscriptionFailed: 'trackSubscriptionFailed',
    DataReceived: 'dataReceived',
  },
  Track: { Kind: { Audio: 'audio' } },
}));

describe('LiveKit voice media', () => {
  beforeEach(() => jest.clearAllMocks());
  it('suppresses normal removal and stale events but reports failed subscription', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const room = {
      localParticipant: {
        identity: 'self',
        isMicrophoneEnabled: false,
        audioTrackPublications: new Map(),
      },
      remoteParticipants: new Map(),
      on: jest.fn((event, listener) => handlers.set(event, listener)),
      connect: jest.fn(async () => undefined),
      disconnect: jest.fn(async () => undefined),
      removeAllListeners: jest.fn(),
    };
    (Room as unknown as jest.Mock).mockImplementation(() => room);
    const media = new LiveKitVoiceMedia({
      start: async () => undefined,
      stop: async () => undefined,
      attachRemoteAudio() {},
      detachRemoteAudio() {},
    });
    await media.connect({
      serverUrl: 'wss://example.invalid',
      participantToken: 'PRIVATE_CANARY',
    } as never);
    handlers.get('disconnected')?.(4);
    expect(reportMobileError).not.toHaveBeenCalled();
    handlers.get('trackSubscriptionFailed')?.('PRIVATE_CANARY');
    expect(reportMobileError).toHaveBeenCalledWith(
      { code: 'VOICE_TRACK_SUBSCRIPTION_FAILED' },
      { code: 'VOICE_TRACK_SUBSCRIPTION_FAILED', stage: 'subscribe' },
    );
    await media.disconnect();
    handlers.get('reconnecting')?.();
    handlers.get('disconnected')?.(0);
    expect(media.snapshot.connection).toBe('disconnected');
    expect(reportMobileError).toHaveBeenCalledTimes(1);
    expect(room.removeAllListeners).toHaveBeenCalled();
  });
  it('records successful stages and only bounded local quality, cleaning up on exit', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const room = {
      localParticipant: {
        identity: 'PRIVATE_CANARY',
        isMicrophoneEnabled: false,
        audioTrackPublications: new Map(),
      },
      remoteParticipants: new Map(),
      on: jest.fn((event, listener) => handlers.set(event, listener)),
      connect: jest.fn(async () => undefined),
      disconnect: jest.fn(async () => undefined),
      removeAllListeners: jest.fn(),
    };
    (Room as unknown as jest.Mock).mockImplementation(() => room);
    const media = new LiveKitVoiceMedia({
      start: async () => undefined,
      stop: async () => undefined,
      attachRemoteAudio() {},
      detachRemoteAudio() {},
    });
    await media.connect({
      serverUrl: 'wss://example.invalid',
      participantToken: 'PRIVATE_CANARY',
    } as never);
    expect(beginVoiceTrace).toHaveBeenCalledWith('connect');
    const initial = (beginVoiceTrace as jest.Mock).mock.results[0]!.value as jest.Mock;
    expect(initial).toHaveBeenCalledWith('ok');
    handlers.get('qualityChanged')?.('poor', { identity: 'other' });
    expect(beginVoiceTrace).not.toHaveBeenCalledWith('quality', 'poor');
    for (let i = 0; i < 25; i++)
      handlers.get('qualityChanged')?.(i % 2 ? 'good' : 'poor', room.localParticipant);
    expect(
      (beginVoiceTrace as jest.Mock).mock.calls.filter(([stage]) => stage === 'quality'),
    ).toHaveLength(21);
    handlers.get('reconnecting')?.();
    handlers.get('reconnecting')?.();
    handlers.get('reconnected')?.();
    expect(
      (beginVoiceTrace as jest.Mock).mock.calls.filter(([stage]) => stage === 'reconnect'),
    ).toHaveLength(1);
    expect(reportMobileError).not.toHaveBeenCalled();
    await media.disconnect();
    const count = (beginVoiceTrace as jest.Mock).mock.calls.length;
    handlers.get('qualityChanged')?.('lost', room.localParticipant);
    expect((beginVoiceTrace as jest.Mock).mock.calls).toHaveLength(count);
    expect(JSON.stringify((beginVoiceTrace as jest.Mock).mock.calls)).not.toContain(
      'PRIVATE_CANARY',
    );
  });
  it('connects muted and publishes microphone audio only after an explicit action', async () => {
    const localParticipant = {
      identity: 'self',
      audioTrackPublications: new Map(),
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
      removeAllListeners: jest.fn(),
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
      localParticipant: {
        identity: 'self',
        audioTrackPublications: new Map(),
        isSpeaking: false,
        isMicrophoneEnabled: false,
      },
      remoteParticipants: new Map(),
      on: jest.fn((event: string, listener: (...args: unknown[]) => void) =>
        handlers.set(event, listener),
      ),
      connect: jest.fn(async () => undefined),
      disconnect: jest.fn(async () => undefined),
      removeAllListeners: jest.fn(),
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
    audioTrackPublications: new Map(),
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
    removeAllListeners: jest.fn(),
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
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  room.connect.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        connected = resolve;
        started();
      }),
  );
  const connecting = media.connect(deviceCredential);
  await startedPromise;
  await media.disconnect();
  connected();
  await connecting;
  expect(media.snapshot.connection).toBe('disconnected');
  expect(platform.checkMicrophone).not.toHaveBeenCalled();
  expect(room.disconnect).toHaveBeenCalled();
});

it('warms the same SDK Room without waiting for the warmup request before connecting', async () => {
  const { room, media } = deviceFixture(async () => 'ready');
  const prepare = jest.fn(() => new Promise<void>(() => {}));
  Object.assign(room, { prepareConnection: prepare });
  await media.connect(deviceCredential);
  expect(prepare).toHaveBeenCalledWith('wss://example.invalid');
  expect(prepare.mock.invocationCallOrder[0]).toBeLessThan(
    room.connect.mock.invocationCallOrder[0]!,
  );
  expect(Room).toHaveBeenCalled();
  expect(media.snapshot.timings?.connectedMs).toEqual(expect.any(Number));
  await media.disconnect();
});
it('classifies provider room deletion separately from transient network recovery', async () => {
  const { room, media } = deviceFixture(async () => 'ready');
  await media.connect(deviceCredential);
  const handler = room.on.mock.calls.find((call) => call[0] === 'disconnected')![1];
  handler(1);
  expect(media.snapshot).toMatchObject({ connection: 'disconnected', disconnectReason: 'ended' });
  await media.disconnect();
});
