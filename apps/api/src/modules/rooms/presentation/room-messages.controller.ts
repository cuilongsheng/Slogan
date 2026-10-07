import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { RoomMessageService } from '../application/services/room-message.service.js';
import { RoomIdParamsDto } from './dto/room.dto.js';
import {
  RoomMessageDto,
  RoomMessagesPageDto,
  RoomMessagesQueryDto,
  SendRoomMessageDto,
} from './dto/room-message.dto.js';
@ApiTags('rooms')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiTooManyRequestsResponse({ type: ErrorResponseDto })
@Controller('rooms/:roomId/messages')
export class RoomMessagesController {
  constructor(private readonly messages: RoomMessageService) {}
  @Get()
  @ApiOkResponse({ type: RoomMessagesPageDto })
  list(
    @CurrentIdentity() actor: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Query() query: RoomMessagesQueryDto,
  ) {
    return this.messages.list(params.roomId, actor.userId, query);
  }
  @Post()
  @HttpCode(200)
  @ApiOkResponse({ type: RoomMessageDto })
  send(
    @CurrentIdentity() actor: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: SendRoomMessageDto,
  ) {
    return this.messages.send(params.roomId, actor.userId, body);
  }
}
