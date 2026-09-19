import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { ListRoomHistoryQueryDto, RoomHistoryListDto } from './dto/room-history.dto.js';
import { presentRoomHistoryItem } from './room-history.presenter.js';

@ApiTags('room-history')
@ApiBearerAuth()
@Controller('me/room-history')
export class RoomHistoryController {
  constructor(private readonly history: RoomHistoryService) {}

  @Get()
  @ApiOkResponse({ type: RoomHistoryListDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: ListRoomHistoryQueryDto,
  ): Promise<RoomHistoryListDto> {
    const page = await this.history.list(identity.userId, query);
    return { items: page.items.map(presentRoomHistoryItem), nextCursor: page.nextCursor };
  }
}
