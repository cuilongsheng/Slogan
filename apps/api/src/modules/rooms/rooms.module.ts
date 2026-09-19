import { AppointmentsService } from './application/services/appointments.service.js';
import { PrismaAppointmentRepository } from './infrastructure/prisma-appointment.repository.js';
import { APPOINTMENT_REPOSITORY } from './domain/ports/appointment.repository.js';
import { AppointmentsController } from './presentation/appointments.controller.js';
import { RoomHistoryService } from './application/services/room-history.service.js';
import { ROOM_HISTORY_REPOSITORY } from './domain/ports/room-history.repository.js';
import { RoomNotePolicy } from './domain/policies/room-note.policy.js';
import { PrismaRoomHistoryRepository } from './infrastructure/prisma-room-history.repository.js';
import { RoomHistoryController } from './presentation/room-history.controller.js';
import { RoomNoteController } from './presentation/room-note.controller.js';
import { HostControlsService } from './application/services/host-controls.service.js';
import { Module } from '@nestjs/common';

import { ProfilesModule } from '../profiles/index.js';
import { RoomRealtimeService } from './application/services/room-realtime.service.js';
import { ROOM_REALTIME_REPOSITORY } from './domain/ports/room-realtime.repository.js';
import { PrismaRoomRealtimeRepository } from './infrastructure/prisma-room-realtime.repository.js';
import { RoomsService } from './application/services/rooms.service.js';
import { ROOM_PASSWORD_HASHER } from './domain/ports/room-password.port.js';
import { ROOM_REPOSITORY } from './domain/ports/room.repository.js';
import { RoomPolicy } from './domain/policies/room.policy.js';
import { HmacRoomPasswordAdapter } from './infrastructure/hmac-room-password.adapter.js';
import { PrismaRoomRepository } from './infrastructure/prisma-room.repository.js';
import { RoomsController } from './presentation/rooms.controller.js';
import { RoomLinksController } from './presentation/room-links.controller.js';
import { SocialModule } from '../social/index.js';
import { RoomInvitationsService } from './application/services/room-invitations.service.js';
import { ROOM_INVITATION_REPOSITORY } from './domain/ports/room-invitation.repository.js';
import { PrismaRoomInvitationRepository } from './infrastructure/prisma-room-invitation.repository.js';
import { RoomInvitationsController } from './presentation/room-invitations.controller.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';

@Module({
  imports: [ProfilesModule, SocialModule, RedisModule],
  controllers: [
    RoomsController,
    RoomLinksController,
    AppointmentsController,
    RoomHistoryController,
    RoomNoteController,
    RoomInvitationsController,
  ],
  providers: [
    RoomHistoryService,
    RoomNotePolicy,
    PrismaRoomHistoryRepository,
    { provide: ROOM_HISTORY_REPOSITORY, useExisting: PrismaRoomHistoryRepository },
    AppointmentsService,
    PrismaAppointmentRepository,
    { provide: APPOINTMENT_REPOSITORY, useExisting: PrismaAppointmentRepository },
    RoomsService,
    HostControlsService,
    RoomRealtimeService,
    PrismaRoomRealtimeRepository,
    { provide: ROOM_REALTIME_REPOSITORY, useExisting: PrismaRoomRealtimeRepository },
    RoomPolicy,
    PrismaRoomRepository,
    HmacRoomPasswordAdapter,
    { provide: ROOM_REPOSITORY, useExisting: PrismaRoomRepository },
    { provide: ROOM_PASSWORD_HASHER, useExisting: HmacRoomPasswordAdapter },
    RoomInvitationsService,
    PrismaRoomInvitationRepository,
    { provide: ROOM_INVITATION_REPOSITORY, useExisting: PrismaRoomInvitationRepository },
  ],
  exports: [
    RoomsService,
    RoomRealtimeService,
    HostControlsService,
    RoomHistoryService,
    RoomInvitationsService,
  ],
})
export class RoomsModule {}
