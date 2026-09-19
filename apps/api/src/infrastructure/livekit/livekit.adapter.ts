import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccessToken,
  DataPacket_Kind,
  RoomServiceClient,
  TrackSource,
  WebhookReceiver,
} from 'livekit-server-sdk';
import type { Environment } from '../../config/environment.js';
import {
  RealtimeError,
  type RealtimeProvider,
  type ProviderEvent,
} from '../../modules/voice/index.js';

@Injectable()
export class LivekitAdapter implements RealtimeProvider {
  private readonly client: RoomServiceClient | null;
  private readonly receiver: WebhookReceiver | null;
  constructor(private readonly config: ConfigService<Environment, true>) {
    const enabled = config.get('REALTIME_ENABLED', { infer: true });
    const key = config.get('LIVEKIT_API_KEY', { infer: true });
    const secret = config.get('LIVEKIT_API_SECRET', { infer: true });
    this.client = enabled
      ? new RoomServiceClient(
          config.get('LIVEKIT_URL', { infer: true })!.replace('wss:', 'https:'),
          key,
          secret,
          { requestTimeout: 5, failover: false },
        )
      : null;
    this.receiver = enabled ? new WebhookReceiver(key!, secret!) : null;
  }
  async ensureRoom(roomId: string, capacity: number, metadata: string) {
    return this.call(async (client) => {
      const existing = (await client.listRooms([this.name(roomId)]))[0];
      if (existing) {
        if (existing.maxParticipants !== capacity)
          throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
        if (existing.metadata !== metadata)
          await client.updateRoomMetadata(this.name(roomId), metadata);
        return existing.sid;
      }
      return (
        await client.createRoom({
          name: this.name(roomId),
          maxParticipants: capacity,
          emptyTimeout: 300,
          departureTimeout: 120,
          metadata,
        })
      ).sid;
    });
  }
  async updateRoomMetadata(roomId: string, metadata: string) {
    return this.call(async (client) => {
      try {
        await client.updateRoomMetadata(this.name(roomId), metadata);
        return 'UPDATED' as const;
      } catch (error) {
        if (this.notFound(error)) return 'NOT_FOUND' as const;
        throw error;
      }
    });
  }
  async token(roomId: string, identity: string, ttl: number) {
    if (!this.client) throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
    const token = new AccessToken(
      this.config.get('LIVEKIT_API_KEY', { infer: true }),
      this.config.get('LIVEKIT_API_SECRET', { infer: true }),
      { identity, ttl },
    );
    token.addGrant({
      room: this.name(roomId),
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canPublishData: false,
      canUpdateOwnMetadata: false,
      roomAdmin: false,
      roomCreate: false,
      roomRecord: false,
      roomList: false,
    });
    const jwt = await token.toJwt();
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString()) as {
      exp: number;
    };
    return { token: jwt, expiresAt: new Date(claims.exp * 1000) };
  }
  async participants(roomId: string) {
    return this.call(async (client) => {
      const room = (await client.listRooms([this.name(roomId)]))[0];
      if (!room) return { roomSid: null, participants: [] };
      const participants = await client.listParticipants(this.name(roomId));
      return {
        roomSid: room.sid,
        participants: participants.map((p) => ({ identity: p.identity, sessionSid: p.sid })),
      };
    });
  }
  async revoke(roomId: string, identity: string) {
    // +1 closes the same-second nbf equality edge; Cloud permits a cutoff within 60 seconds.
    await this.call((client) =>
      client.removeParticipant(this.name(roomId), identity, {
        revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
      }),
    );
    // A not-found response is NOT accepted as proof that the explicit cutoff was applied.
  }
  async deleteRoom(roomId: string) {
    await this.call(async (client) => {
      try {
        await client.deleteRoom(this.name(roomId));
      } catch (error) {
        if (!this.notFound(error)) throw error;
      }
    });
  }
  async sendData(roomId: string, payload: Uint8Array, destinationIdentities: string[]) {
    await this.call((client) =>
      client.sendData(this.name(roomId), payload, DataPacket_Kind.RELIABLE, {
        destinationIdentities,
        topic: 'slogan.room-safety-alert.v1',
      }),
    );
  }
  async verifyWebhook(body: string, authorization: string): Promise<ProviderEvent | null> {
    if (!this.receiver) throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
    try {
      const event = await this.receiver.receive(body, authorization);
      const types: Record<string, ProviderEvent['type']> = {
        participant_joined: 'joined',
        participant_left: 'left',
        participant_connection_aborted: 'aborted',
        room_finished: 'finished',
      };
      const type = types[event.event];
      if (!type) return null;
      const occurredAt = new Date(Number(event.createdAt) * 1000);
      if (
        !event.id ||
        !event.room?.name ||
        !event.room.sid ||
        !Number.isFinite(occurredAt.getTime()) ||
        (type !== 'finished' && (!event.participant?.identity || !event.participant.sid))
      )
        throw new Error('Invalid event');
      return {
        id: event.id,
        roomName: event.room.name,
        roomSid: event.room.sid,
        type,
        identity: event.participant?.identity,
        sessionSid: event.participant?.sid,
        occurredAt,
      };
    } catch {
      throw new RealtimeError('REALTIME_WEBHOOK_INVALID');
    }
  }
  private name(id: string) {
    return `room-${id}`;
  }
  private notFound(error: unknown) {
    return (
      typeof error === 'object' && error !== null && 'code' in error && error.code === 'not_found'
    );
  }
  private async call<T>(operation: (client: RoomServiceClient) => Promise<T>): Promise<T> {
    if (!this.client) throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
    try {
      return await operation(this.client);
    } catch {
      throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
    }
  }
}
