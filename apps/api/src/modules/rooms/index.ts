export { RoomsModule } from './rooms.module.js';
export { RoomsService } from './application/services/rooms.service.js';
export { RoomHistoryService } from './application/services/room-history.service.js';
export { AppointmentsService } from './application/services/appointments.service.js';
export { ROOM_CEFR_LEVELS } from './domain/entities/room.js';
export type {
  CreateRoomInput,
  RoomCefrLevel,
  RoomDetail,
  RoomListCursor,
  RoomListPage,
  RoomDiscoveryFilter,
  RoomExtensionResult,
  RoomMembershipRecord,
  RoomMembershipRole,
  RoomRecord,
  RoomShareRecord,
  RoomVisibility,
  RoomStatus,
  ValidatedRoomCreation,
} from './domain/entities/room.js';
export { RoomError } from './domain/errors/room.error.js';
export type { RoomErrorCode } from './domain/errors/room.error.js';
export { RoomHistoryError } from './domain/errors/room-history.error.js';
export type { RoomHistoryErrorCode } from './domain/errors/room-history.error.js';
export type {
  RoomHistoryCursor,
  RoomHistoryItem,
  RoomHistoryRelationship,
  RoomNoteRecord,
  RoomReservationHistoryStatus,
} from './domain/entities/room-history.js';
export { ROOM_PASSWORD_HASHER } from './domain/ports/room-password.port.js';
export type { RoomPasswordHasher } from './domain/ports/room-password.port.js';
export { ROOM_REPOSITORY } from './domain/ports/room.repository.js';
export type {
  CreateRoomRepositoryInput,
  LockedRoom,
  RoomAssistanceContext,
  RoomRepository,
} from './domain/ports/room.repository.js';

export { RoomRealtimeService } from './application/services/room-realtime.service.js';
export type {
  CredentialReservation,
  RealtimeSignal,
} from './application/services/room-realtime.service.js';
export { ROOM_REALTIME_REPOSITORY } from './domain/ports/room-realtime.repository.js';
export type {
  RoomRealtimeRepository,
  LockedRealtimeRoom,
  RealtimeCommand,
} from './domain/ports/room-realtime.repository.js';

export {
  HostControlsService,
  ROOM_COMMAND_DELIVERY,
} from './application/services/host-controls.service.js';
export { HostControlsController } from './presentation/host-controls.controller.js';
export { RoomExtensionsController } from './presentation/room-extensions.controller.js';
export { RoomInvitationsService } from './application/services/room-invitations.service.js';
export { loadLockedRealtimeRoom } from './infrastructure/locked-realtime-room.js';
export { roomLifecycle } from './domain/policies/room-lifecycle.js';
