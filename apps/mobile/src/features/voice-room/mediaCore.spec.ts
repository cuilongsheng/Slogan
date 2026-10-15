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
  DisconnectReason: { CLIENT_INITIATED: 1, PARTICIPANT_REMOVED: 4, ROOM_DELETED: 5 },
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
      localParticipant: { identity: 'self', isMicrophoneEnabled: false },
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
      localParticipant: { identity: 'PRIVATE_CANARY', isMicrophoneEnabled: false },
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

    await media.setMicrophoneEnabled(true);
    expect(localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(media.snapshot.microphoneEnabled).toBe(true);
    await media.disconnect();
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
