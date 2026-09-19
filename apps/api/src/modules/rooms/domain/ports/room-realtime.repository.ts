import type { RoomStatus } from '../entities/room.js';

export interface RealtimeRoomRecord {
  id: string;
  hostUserId: string;
  kind: 'INSTANT' | 'APPOINTMENT';
  startedAt: Date;
  initialHostDeadline: Date | null;
  initialHostResolved: boolean;
  hostDisconnectedAt: Date | null;
  hostReconnectDeadline: Date | null;
  hostReconnectVersion: number;
  status: RoomStatus;
  stateVersion: number;
  extensionCount: number;
  capacity: number;
  endsAt: Date;
  providerRoomSid: string | null;
  endedAt: Date | null;
  endedReason: string | null;
}
export interface RealtimeMember {
  id: string;
  userId: string;
  role: 'HOST' | 'MEMBER';
  lifecycle: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'INVITED';
  leftAt: Date | null;
  removedAt: Date | null;
  removalReason: string | null;
  joinOrder: number;
  displayName: string;
  cefrLevel: string;
  accountActive: boolean;
  participantIdentity: string;
  credentialVersion: number;
  presence: 'CONNECTED' | 'DISCONNECTED';
  providerSessionSid: string | null;
  presenceUpdatedAt: Date | null;
}
export interface IdentityRecord {
  identity: string;
  roomId: string;
  membershipId: string;
  credentialVersion: number;
  issueUntil: Date;
  revokedAt: Date | null;
}
export interface RealtimeEvent {
  providerEventId?: string;
  type: string;
  source: string;
  actorId?: string;
  targetId?: string;
  reason?: string;
  result: string;
  occurredAt: Date;
}
export interface RealtimeCommand {
  id: string;
  roomId: string;
  type: 'REVOKE_IDENTITY' | 'DELETE_ROOM' | 'HOST_TIMEOUT' | 'SYNC_ROOM_TIME';
  identity: string | null;
  stateVersion: number;
  leaseId: string | null;
  attempts: number;
}
export interface LockedRealtimeRoom {
  room: RealtimeRoomRecord;
  members: RealtimeMember[];
  identities: IdentityRecord[];
  reservedUserIds: string[];
  expireReservations(): Promise<void>;
  now: Date;
  safetyRestriction(userId: string): Promise<{ severity: string; endsAt: Date } | null>;
  saveRoom(
    patch: Partial<
      Pick<
        RealtimeRoomRecord,
        | 'initialHostResolved'
        | 'status'
        | 'stateVersion'
        | 'providerRoomSid'
        | 'endedAt'
        | 'endedReason'
        | 'hostUserId'
        | 'hostDisconnectedAt'
        | 'hostReconnectDeadline'
        | 'hostReconnectVersion'
        | 'endsAt'
        | 'extensionCount'
      >
    >,
  ): Promise<void>;
  saveMember(
    id: string,
    patch: Partial<
      Pick<
        RealtimeMember,
        | 'presence'
        | 'presenceUpdatedAt'
        | 'providerSessionSid'
        | 'role'
        | 'lifecycle'
        | 'leftAt'
        | 'removedAt'
        | 'removalReason'
        | 'credentialVersion'
      >
    >,
  ): Promise<void>;
  reserveIssuance(id: string, identity: string, expiresAt: Date): Promise<void>;
  rememberIdentity(record: IdentityRecord): Promise<void>;
  appendEvent(event: RealtimeEvent): Promise<boolean>;
  enqueue(type: RealtimeCommand['type'], identity?: string): Promise<void>;
}
export const ROOM_REALTIME_REPOSITORY = Symbol('ROOM_REALTIME_REPOSITORY');
export interface RoomRealtimeRepository {
  withRoom<T>(
    roomId: string,
    operation: (locked: LockedRealtimeRoom) => Promise<T>,
  ): Promise<T | null>;
  operationStatus(
    roomId: string,
  ): Promise<{ roomStatus: RoomStatus; providerStatus: 'COMPLETED' | 'PENDING' | 'UNAVAILABLE' }>;
  finishIssuance(id: string): Promise<void>;
  recordIgnoredEvent(event: RealtimeEvent): Promise<void>;
  recoverableRooms(): Promise<RealtimeRoomRecord[]>;
  scheduledHostTimeouts(): Promise<Array<{ id: string; runAt: Date }>>;
  pendingCommands(roomId?: string): Promise<string[]>;
  claimCommand(id: string): Promise<RealtimeCommand | null>;
  completeCommand(command: RealtimeCommand): Promise<void>;
  failCommand(command: RealtimeCommand): Promise<void>;
}
