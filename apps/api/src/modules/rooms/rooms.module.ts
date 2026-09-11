import { Module } from '@nestjs/common';

import { ProfilesModule } from '../profiles/index.js';
import { RoomsService } from './application/services/rooms.service.js';
import { ROOM_PASSWORD_HASHER } from './domain/ports/room-password.port.js';
import { ROOM_REPOSITORY } from './domain/ports/room.repository.js';
import { RoomPolicy } from './domain/policies/room.policy.js';
import { HmacRoomPasswordAdapter } from './infrastructure/hmac-room-password.adapter.js';
import { PrismaRoomRepository } from './infrastructure/prisma-room.repository.js';
import { RoomsController } from './presentation/rooms.controller.js';

@Module({
  imports: [ProfilesModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    RoomPolicy,
    PrismaRoomRepository,
    HmacRoomPasswordAdapter,
    { provide: ROOM_REPOSITORY, useExisting: PrismaRoomRepository },
    { provide: ROOM_PASSWORD_HASHER, useExisting: HmacRoomPasswordAdapter },
  ],
  exports: [RoomsService],
})
export class RoomsModule {}
