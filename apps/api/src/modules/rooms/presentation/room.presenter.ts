import { roomLevelRange } from '../domain/policies/room-level-range.js';
import type { RoomDetail, RoomMembershipRecord, RoomRecord } from '../domain/entities/room.js';
import type { RoomDetailDto, RoomDto, RoomMembershipDto } from './dto/room.dto.js';

export function presentRoom(room: RoomRecord): RoomDto {
  return {
    id: room.id,
    hostUserId: room.hostUserId,
    hostDisplayName: room.hostDisplayName,
    visibility: room.visibility,
    topic: room.topic,
    cefrLevel: roomLevelRange(room).cefrLevelMin,
    ...roomLevelRange(room),
    capacity: room.capacity,
    memberCount: room.memberCount,
    hostReconnectDeadline: room.hostReconnectDeadline?.toISOString() ?? null,
    passwordProtected: room.passwordDigest !== null,
    startedAt: room.startedAt.toISOString(),
    endsAt: room.endsAt.toISOString(),
    sensitiveSpeechDetectionEnabled: room.sensitiveSpeechDetectionEnabled,
    postRoomKeywordsEnabled: room.postRoomKeywordsEnabled,
  };
}

export function presentMembership(membership: RoomMembershipRecord): RoomMembershipDto {
  return {
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
    joinOrder: membership.joinOrder,
    lifecycle: membership.lifecycle,
    credentialVersion: membership.credentialVersion,
    rulesVersion: membership.rulesVersion,
    rulesAcceptedAt: membership.rulesAcceptedAt.toISOString(),
    joinedAt: membership.joinedAt.toISOString(),
  };
}

export function presentRoomDetail(detail: RoomDetail & { shareUrl: string }): RoomDetailDto {
  return {
    ...presentRoom(detail.room),
    currentMembership:
      detail.currentMembership === null ? null : presentMembership(detail.currentMembership),
    shareUrl: detail.shareUrl,
  };
}
