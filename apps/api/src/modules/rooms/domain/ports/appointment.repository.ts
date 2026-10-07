import type {
  CreateRoomInput,
  RoomDiscoveryFilter,
  RoomListCursor,
  RoomStatus,
  RoomVisibility,
} from '../entities/room.js';
export interface AppointmentInput extends CreateRoomInput {
  startsAt: string;
  endsAt: string;
}
export interface ReservationRecord {
  id: string;
  status: 'BOOKED' | 'CANCELLED' | 'CONSUMED' | 'EXPIRED';
  version: number;
}
export interface AppointmentRecord {
  id: string;
  hostUserId: string;
  topic: string;
  cefrLevel: string;
  cefrLevelMin?: import('../entities/room.js').RoomCefrLevel;
  cefrLevelMax?: import('../entities/room.js').RoomCefrLevel;
  capacity: number;
  status: RoomStatus;
  startedAt: Date;
  endsAt: Date;
  passwordDigest: string | null;
  memberCount: number;
  reservedCount: number;
  availableCount: number;
  reservation: ReservationRecord | null;
  visibility: RoomVisibility;
  shareCode: string;
  sensitiveSpeechDetectionEnabled: boolean;
  postRoomKeywordsEnabled: boolean;
}
export interface LockedAppointment {
  room: AppointmentRecord;
  now: Date;
  accountActive: boolean;
  safetyRestriction: { severity: string; endsAt: Date } | null;
  book(): Promise<ReservationRecord>;
  cancelReservation(): Promise<ReservationRecord>;
  cancelRoom(): Promise<AppointmentRecord>;
}
export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');
export interface AppointmentRepository {
  create(input: {
    id: string;
    userId: string;
    topic: string;
    cefrLevel: import('../entities/room.js').RoomCefrLevel;
    cefrLevelMin?: import('../entities/room.js').RoomCefrLevel;
    cefrLevelMax?: import('../entities/room.js').RoomCefrLevel;
    capacity: number;
    startedAt: Date;
    endsAt: Date;
    passwordDigest: string | null;
    visibility: RoomVisibility;
    shareCode: string;
    sensitiveSpeechDetectionEnabled: boolean;
    postRoomKeywordsEnabled: boolean;
    keywordExtractorVersion: string;
  }): Promise<AppointmentRecord>;
  withRoom<T>(
    roomId: string,
    userId: string,
    operation: (ctx: LockedAppointment) => Promise<T>,
  ): Promise<T>;
  list(input: {
    userId: string;
    limit: number;
    cursor: RoomListCursor | null;
    filter: RoomDiscoveryFilter;
  }): Promise<{ items: AppointmentRecord[]; nextCursor: RoomListCursor | null }>;
}
