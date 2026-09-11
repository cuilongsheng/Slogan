export const ROOM_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type RoomCefrLevel = (typeof ROOM_CEFR_LEVELS)[number];

export type RoomStatus = 'OPEN' | 'ENDED';
export type RoomMembershipRole = 'HOST' | 'MEMBER';

export interface RoomMembershipRecord {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMembershipRole;
  joinOrder: number;
  rulesVersion: string;
  rulesAcceptedAt: Date;
  joinedAt: Date;
}

export interface RoomRecord {
  id: string;
  hostUserId: string;
  hostDisplayName: string;
  topic: string;
  cefrLevel: RoomCefrLevel;
  capacity: number;
  passwordDigest: string | null;
  status: RoomStatus;
  startedAt: Date;
  endsAt: Date;
  memberCount: number;
}

export interface RoomDetail {
  room: RoomRecord;
  currentMembership: RoomMembershipRecord | null;
}

export interface RoomListCursor {
  startedAt: Date;
  id: string;
}

export interface RoomListPage {
  items: RoomRecord[];
  nextCursor: RoomListCursor | null;
}

export interface CreateRoomInput {
  topic: string;
  cefrLevel: RoomCefrLevel;
  capacity: number;
  password?: string;
}

export interface ValidatedRoomCreation {
  topic: string;
  cefrLevel: RoomCefrLevel;
  capacity: number;
  startedAt: Date;
  endsAt: Date;
}
