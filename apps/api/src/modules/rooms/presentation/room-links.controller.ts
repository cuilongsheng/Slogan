import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiGoneResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../../../common/decorators/public.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { RoomsService } from '../application/services/rooms.service.js';
import type { RoomShareRecord } from '../domain/entities/room.js';
import { RoomShareDto, RoomShareParamsDto, RoomShareQueryDto } from './dto/room.dto.js';

function presentShare(room: RoomShareRecord): RoomShareDto {
  return {
    attributionId: room.attributionId,
    id: room.id,
    kind: room.kind,
    status: room.status,
    visibility: room.visibility,
    topic: room.topic,
    cefrLevel: room.cefrLevel,
    capacity: room.capacity,
    memberCount: room.memberCount,
    reservedCount: room.reservedCount,
    availableCount: room.availableCount,
    startsAt: room.startedAt.toISOString(),
    endsAt: room.endsAt.toISOString(),
    hostDisplayName: room.hostDisplayName,
    passwordProtected: room.passwordProtected,
    sensitiveSpeechDetectionEnabled: room.sensitiveSpeechDetectionEnabled,
    postRoomKeywordsEnabled: room.postRoomKeywordsEnabled,
  };
}

@ApiTags('room-links')
@Public()
@Controller('room-links')
export class RoomLinksController {
  constructor(private readonly rooms: RoomsService) {}

  @Get(':shareCode')
  @ApiOkResponse({ type: RoomShareDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiGoneResponse({ type: ErrorResponseDto })
  async resolve(
    @Param() params: RoomShareParamsDto,
    @Query() query: RoomShareQueryDto,
  ): Promise<RoomShareDto> {
    return presentShare(await this.rooms.resolveShare(params.shareCode, query.attributionId));
  }
}
