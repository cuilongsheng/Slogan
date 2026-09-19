import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { RoomHistoryService } from '../application/services/room-history.service.js';
import { RoomIdParamsDto } from './dto/room.dto.js';
import { RoomNoteDto, SaveRoomNoteDto } from './dto/room-history.dto.js';
import { presentRoomNote } from './room-history.presenter.js';

@ApiTags('room-history')
@ApiBearerAuth()
@Controller('rooms/:roomId/note')
export class RoomNoteController {
  constructor(private readonly history: RoomHistoryService) {}

  @Get()
  @ApiOkResponse({ type: RoomNoteDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async get(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
  ): Promise<RoomNoteDto> {
    return presentRoomNote(await this.history.getNote(identity.userId, params.roomId));
  }

  @Put()
  @ApiOkResponse({ type: RoomNoteDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async save(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: SaveRoomNoteDto,
  ): Promise<RoomNoteDto> {
    return presentRoomNote(await this.history.saveNote(identity.userId, params.roomId, body));
  }
}
