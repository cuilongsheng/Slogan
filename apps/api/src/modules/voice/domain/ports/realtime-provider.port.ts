export const REALTIME_PROVIDER = Symbol('REALTIME_PROVIDER');
export interface ProviderParticipant {
  identity: string;
  sessionSid: string;
}
export interface ProviderEvent {
  id: string;
  roomName: string;
  roomSid: string;
  type: 'joined' | 'left' | 'aborted' | 'finished';
  identity?: string | undefined;
  sessionSid?: string | undefined;
  occurredAt: Date;
}
export interface RealtimeProvider {
  ensureRoom(roomId: string, capacity: number, metadata: string): Promise<string>;
  updateRoomMetadata(roomId: string, metadata: string): Promise<'UPDATED' | 'NOT_FOUND'>;
  token(roomId: string, identity: string, ttl: number): Promise<{ token: string; expiresAt: Date }>;
  participants(
    roomId: string,
  ): Promise<{ roomSid: string | null; participants: ProviderParticipant[] }>;
  revoke(roomId: string, identity: string): Promise<void>;
  deleteRoom(roomId: string): Promise<void>;
  sendData(roomId: string, payload: Uint8Array, destinationIdentities: string[]): Promise<void>;
  verifyWebhook(body: string, authorization: string): Promise<ProviderEvent | null>;
}
