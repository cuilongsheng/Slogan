import type { RoomMembershipRecord, RoomStatus } from './room.js';

export type RoomHistoryRelationship = 'PARTICIPATED' | 'RESERVED_ONLY';
export type RoomReservationHistoryStatus = 'BOOKED' | 'CANCELLED' | 'CONSUMED' | 'EXPIRED';

export interface RoomHistoryCursor {
  occurredAt: Date;
  roomId: string;
}

export interface RoomHistoryItem {
  roomId: string;
  kind: 'INSTANT' | 'APPOINTMENT';
  topic: string;
  cefrLevel: string;
  status: RoomStatus;
  startedAt: Date;
  endsAt: Date;
  occurredAt: Date;
  relationship: RoomHistoryRelationship;
  membershipLifecycle: RoomMembershipRecord['lifecycle'] | null;
  membershipRole: RoomMembershipRecord['role'] | null;
  reservationStatus: RoomReservationHistoryStatus | null;
  noteExists: boolean;
}

export interface RoomNoteRecord {
  content: string | null;
  version: number;
  updatedAt: Date | null;
}
