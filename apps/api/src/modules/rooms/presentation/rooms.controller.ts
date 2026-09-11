import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { RoomsService } from '../application/services/rooms.service.js';
import {
  CreateRoomDto,
  JoinRoomDto,
  ListRoomsQueryDto,
  RoomDetailDto,
  RoomIdParamsDto,
  RoomListDto,
} from './dto/room.dto.js';
import { presentRoom, presentRoomDetail } from './room.presenter.js';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Post()
  @ApiCreatedResponse({ type: RoomDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async create(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: CreateRoomDto,
  ): Promise<RoomDetailDto> {
    return presentRoomDetail(await this.rooms.create(identity.userId, body));
  }

  @Get()
  @ApiOkResponse({ type: RoomListDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: ListRoomsQueryDto,
  ): Promise<RoomListDto> {
    const page = await this.rooms.list(identity.userId, query);
    return { items: page.items.map(presentRoom), nextCursor: page.nextCursor };
  }

  @Get(':roomId')
  @ApiOkResponse({ type: RoomDetailDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async detail(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
  ): Promise<RoomDetailDto> {
    return presentRoomDetail(await this.rooms.detail(identity.userId, params.roomId));
  }

  @Post(':roomId/memberships')
  @ApiCreatedResponse({ type: RoomDetailDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async join(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: JoinRoomDto,
  ): Promise<RoomDetailDto> {
    return presentRoomDetail(await this.rooms.join(identity.userId, params.roomId, body));
  }
}
