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
