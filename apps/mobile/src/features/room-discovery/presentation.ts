import type { RoomDetail, RoomSummary } from './api';

export function roomAvailability(room: RoomSummary | RoomDetail, now = Date.now()) {
  if ('status' in room && room.status === 'SCHEDULED') return 'scheduled' as const;
  if (Date.parse(room.endsAt) <= now) return 'ended' as const;
  if (room.hostReconnectDeadline && Date.parse(room.hostReconnectDeadline) > now)
    return 'reconnecting' as const;
  if (room.memberCount >= room.capacity) return 'full' as const;
  return 'available' as const;
}

export function remainingMinutes(endsAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 60_000));
}
