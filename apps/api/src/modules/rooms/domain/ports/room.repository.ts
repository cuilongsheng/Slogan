import type {
  RoomDetail,
  RoomListCursor,
  RoomListPage,
  RoomDiscoveryFilter,
  RoomExtensionResult,
  RoomShareRecord,
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
  shareCode: string;
  keywordExtractorVersion: string;
}

export interface RoomAssistanceContext {
  roomId: string;
  topic: string;
  cefrLevel: string;
  status: RoomRecord['status'];
  endsAt: Date;
  membershipActive: boolean;
  userEligible: boolean;
}

export interface LockedRoom {
  now?: Date;
  reservedUserIds?: string[];
  accountActive: boolean;
  safetyRestriction: { severity: string; endsAt: Date } | null;
  room: RoomRecord;
  existingMembership: RoomMembershipRecord | null;
  nextJoinOrder: number;
  roomSpeechConsentAccepted?: boolean;
  postRoomKeywordsConsentAccepted?: boolean;
  createMembership(input: {
    id: string;
    userId: string;
    rulesVersion: string;
    now: Date;
  }): Promise<RoomMembershipRecord>;
  markShareAttribution(attributionId: string, joinedAt: Date): Promise<void>;
  consumeInvitation(invitationId: string, now: Date): Promise<void>;
}

export interface RoomRepository {
  processingConsentAccepted(
    userId: string,
    purpose: 'ROOM_SAFETY_DETECTION' | 'POST_ROOM_KEYWORDS',
    noticeVersion: string,
  ): Promise<boolean>;
  createWithHost(input: CreateRoomRepositoryInput): Promise<RoomDetail>;
  listOpen(input: {
    userId: string;
    now: Date;
    limit: number;
    cursor: RoomListCursor | null;
    filter: RoomDiscoveryFilter;
  }): Promise<RoomListPage>;
  findDetail(roomId: string, userId: string): Promise<RoomDetail | null>;
  readAssistanceContext(input: {
    roomId: string;
    userId: string;
    now: Date;
  }): Promise<RoomAssistanceContext | null>;
  findByShareCode(
    shareCode: string,
    attributionId?: string,
  ): Promise<{ status: 'FOUND'; room: RoomShareRecord } | { status: 'UNAVAILABLE' } | null>;
  extend(input: {
    roomId: string;
    actorUserId: string;
    clientRequestId: string;
    additionalMinutes: number;
  }): Promise<RoomExtensionResult>;
  withLockedRoom<T>(
    roomId: string,
    userId: string,
    operation: (locked: LockedRoom) => Promise<T>,
  ): Promise<T | null>;
}
