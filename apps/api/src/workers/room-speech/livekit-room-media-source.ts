import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import type { RemoteParticipant, RemoteTrack } from '@livekit/rtc-node';
import type { Environment } from '../../config/environment.js';
import type { RoomMediaSession, RoomMediaSource } from '../../modules/speech-safety/index.js';

export function roomSpeechWorkerGrant(roomId: string) {
  return {
    room: 'room-' + roomId,
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    hidden: true,
    roomAdmin: false,
    roomCreate: false,
    roomRecord: false,
    roomList: false,
  } as const;
}

@Injectable()
export class LivekitRoomMediaSource implements RoomMediaSource {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async healthCheck(): Promise<void> {
    const client = new RoomServiceClient(
      this.config.get('LIVEKIT_URL', { infer: true })!.replace('wss:', 'https:'),
      this.config.get('LIVEKIT_API_KEY', { infer: true }),
      this.config.get('LIVEKIT_API_SECRET', { infer: true }),
      { requestTimeout: 5, failover: false },
    );
    await client.listRooms([]);
  }

  async connect(input: Parameters<RoomMediaSource['connect']>[0]): Promise<RoomMediaSession> {
    if (!this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true }))
      throw new Error('ROOM_SPEECH_DISABLED');
    const { AudioStream, Room, RoomEvent, TrackKind } = await import('@livekit/rtc-node');
    const room = new Room();
    const readers = new Set<ReadableStreamDefaultReader<import('@livekit/rtc-node').AudioFrame>>();
    let closed = false;
    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _publication, participant: RemoteParticipant) => {
        if (track.kind !== TrackKind.KIND_AUDIO || closed) return;
        const stream = new AudioStream(track, {
          sampleRate: 16_000,
          numChannels: 1,
          frameSizeMs: 20,
        });
        const reader = stream.getReader();
        readers.add(reader);
        void (async () => {
          try {
            while (!closed) {
              const { done, value } = await reader.read();
              if (done || !value) break;
              const source = new Uint8Array(
                value.data.buffer,
                value.data.byteOffset,
                value.data.byteLength,
              );
              const copy = new Uint8Array(source.byteLength);
              copy.set(source);
              input.onFrame({
                participantIdentity: participant.identity,
                audio: copy,
                mimeType: 'audio/pcm',
              });
            }
          } catch {
            if (!closed) input.onFailure('MEDIA_STREAM_FAILED');
          } finally {
            readers.delete(reader);
            reader.releaseLock();
          }
        })();
      },
    );
    room.on(RoomEvent.TrackSubscriptionFailed, () => input.onFailure('TRACK_SUBSCRIPTION_FAILED'));
    room.on(RoomEvent.TrackUnsubscribed, (_track, _publication, participant) =>
      input.onParticipantInactive(participant.identity),
    );
    room.on(RoomEvent.ParticipantDisconnected, (participant) =>
      input.onParticipantInactive(participant.identity),
    );
    room.on(RoomEvent.Disconnected, () => {
      if (!closed) input.onFailure('MEDIA_DISCONNECTED');
    });
    const token = new AccessToken(
      this.config.get('LIVEKIT_API_KEY', { infer: true }),
      this.config.get('LIVEKIT_API_SECRET', { infer: true }),
      { identity: 'speech-worker-' + input.roomId + '-' + randomUUID().slice(0, 8), ttl: 300 },
    );
    token.addGrant(roomSpeechWorkerGrant(input.roomId));
    await room.connect(this.config.get('LIVEKIT_URL', { infer: true })!, await token.toJwt(), {
      autoSubscribe: true,
      dynacast: false,
    });
    return {
      close: async () => {
        if (closed) return;
        closed = true;
        await Promise.allSettled([...readers].map((reader) => reader.cancel()));
        await room.disconnect();
      },
    };
  }
}
