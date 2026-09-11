import type {
  RoomDetail,
  RoomListCursor,
  RoomListPage,
  RoomMembershipRecord,
  RoomRecord,
  ValidatedRoomCreation,
} from '../entities/room.js';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');

export interface CreateRoomRepositoryInput extends ValidatedRoomCreation {
  id: string;
  hostUserId: string;
  hostMembershipId: string;
  passwordDigest: string | null;
  rulesVersion: string;
}

export interface LockedRoom {
  room: RoomRecord;
  existingMembership: RoomMembershipRecord | null;
  nextJoinOrder: number;
  createMembership(input: {
    id: string;
    userId: string;
    rulesVersion: string;
    now: Date;
  }): Promise<RoomMembershipRecord>;
}

export interface RoomRepository {
  createWithHost(input: CreateRoomRepositoryInput): Promise<RoomDetail>;
  listOpen(input: {
    userId: string;
    now: Date;
    limit: number;
    cursor: RoomListCursor | null;
  }): Promise<RoomListPage>;
  findDetail(roomId: string, userId: string): Promise<RoomDetail | null>;
  withLockedRoom<T>(
    roomId: string,
    userId: string,
    operation: (locked: LockedRoom) => Promise<T>,
  ): Promise<T | null>;
}
