export const ROOM_CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type RoomCefrLevel = (typeof ROOM_CEFR_LEVELS)[number];
export const ROOM_VISIBILITIES = ['PUBLIC', 'LINK_ONLY'] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export type RoomStatus = 'OPEN' | 'ENDING' | 'ENDED' | 'SCHEDULED' | 'CANCELLED';
export type RoomMembershipRole = 'HOST' | 'MEMBER';

export interface RoomMembershipRecord {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMembershipRole;
  lifecycle: 'ACTIVE' | 'LEFT' | 'REMOVED' | 'INVITED';
  credentialVersion: number;
  joinOrder: number;
  rulesVersion: string;
  rulesAcceptedAt: Date;
  joinedAt: Date;
}

export interface RoomRecord {
  id: string;
  kind: 'INSTANT' | 'APPOINTMENT';
  hostUserId: string;
  hostDisplayName: string;
  topic: string;
  cefrLevel: RoomCefrLevel;
  cefrLevelMin?: RoomCefrLevel;
  cefrLevelMax?: RoomCefrLevel;
  capacity: number;
  passwordDigest: string | null;
  status: RoomStatus;
  startedAt: Date;
  endsAt: Date;
  memberCount: number;
  hostReconnectDeadline: Date | null;
  visibility: RoomVisibility;
  shareCode: string;
  extensionCount: number;
  stateVersion: number;
  sensitiveSpeechDetectionEnabled: boolean;
  postRoomKeywordsEnabled: boolean;
}

export interface RoomDetail {
  room: RoomRecord;
  currentMembership: RoomMembershipRecord | null;
}

export interface RoomListCursor {
  startedAt: Date;
  id: string;
}

export interface RoomDiscoveryFilter {
  cefrLevel: RoomCefrLevel | null;
  topic: string | null;
}

export interface RoomShareRecord {
  attributionId: string;
  id: string;
  kind: 'INSTANT' | 'APPOINTMENT';
  status: RoomStatus;
  visibility: RoomVisibility;
  topic: string;
  cefrLevel: RoomCefrLevel;
  cefrLevelMin?: RoomCefrLevel;
  cefrLevelMax?: RoomCefrLevel;
  capacity: number;
  memberCount: number;
  reservedCount: number;
  availableCount: number;
  startedAt: Date;
  endsAt: Date;
  hostDisplayName: string;
  passwordProtected: boolean;
  sensitiveSpeechDetectionEnabled: boolean;
  postRoomKeywordsEnabled: boolean;
}

export interface RoomExtensionResult {
  roomId: string;
  previousEndsAt: Date;
  endsAt: Date;
  extensionCount: number;
  remainingExtensions: number;
  stateVersion: number;
}

export interface RoomListPage {
  items: RoomRecord[];
  nextCursor: RoomListCursor | null;
}

export interface CreateRoomInput {
  topic: string;
  cefrLevel?: RoomCefrLevel;
  cefrLevelMin?: RoomCefrLevel;
  cefrLevelMax?: RoomCefrLevel;
  capacity: number;
  password?: string;
  visibility?: RoomVisibility;
  sensitiveSpeechDetectionEnabled?: boolean;
  postRoomKeywordsEnabled?: boolean;
}

export interface ValidatedRoomCreation {
  topic: string;
  cefrLevel: RoomCefrLevel;
  cefrLevelMin?: RoomCefrLevel;
  cefrLevelMax?: RoomCefrLevel;
  capacity: number;
  startedAt: Date;
  endsAt: Date;
  visibility: RoomVisibility;
  sensitiveSpeechDetectionEnabled: boolean;
  postRoomKeywordsEnabled: boolean;
}
