import type { RoomDetail, RoomMembershipRecord, RoomRecord } from '../domain/entities/room.js';
import type { RoomDetailDto, RoomDto, RoomMembershipDto } from './dto/room.dto.js';

export function presentRoom(room: RoomRecord): RoomDto {
  return {
    id: room.id,
    hostUserId: room.hostUserId,
    hostDisplayName: room.hostDisplayName,
    topic: room.topic,
    cefrLevel: room.cefrLevel,
    capacity: room.capacity,
    memberCount: room.memberCount,
    passwordProtected: room.passwordDigest !== null,
    startedAt: room.startedAt.toISOString(),
    endsAt: room.endsAt.toISOString(),
  };
}

export function presentMembership(membership: RoomMembershipRecord): RoomMembershipDto {
  return {
    id: membership.id,
    userId: membership.userId,
    role: membership.role,
    joinOrder: membership.joinOrder,
    rulesVersion: membership.rulesVersion,
    rulesAcceptedAt: membership.rulesAcceptedAt.toISOString(),
    joinedAt: membership.joinedAt.toISOString(),
  };
}

export function presentRoomDetail(detail: RoomDetail): RoomDetailDto {
  return {
    ...presentRoom(detail.room),
    currentMembership:
      detail.currentMembership === null ? null : presentMembership(detail.currentMembership),
  };
}
