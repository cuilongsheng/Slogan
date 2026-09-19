export { RoomPolicy } from './domain/policies/room.policy.js';
export { HmacRoomPasswordAdapter } from './infrastructure/hmac-room-password.adapter.js';
export {
  isRetryableRoomTransactionError,
  runRoomTransactionWithRetry,
} from './infrastructure/transaction-retry.js';
export {
  CreateRoomDto,
  JoinRoomDto,
  ListRoomsQueryDto,
  RoomIdParamsDto,
} from './presentation/dto/room.dto.js';

export { AppointmentsService } from './application/services/appointments.service.js';
export { roomLifecycle } from './domain/policies/room-lifecycle.js';
export { RoomNotePolicy } from './domain/policies/room-note.policy.js';
export { RoomHistoryService } from './application/services/room-history.service.js';
