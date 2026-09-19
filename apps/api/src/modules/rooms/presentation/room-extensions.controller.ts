import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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
import { HostControlsService } from '../application/services/host-controls.service.js';
import {
  ROOM_COMMAND_DELIVERY,
  type RoomCommandDelivery,
} from '../application/services/host-controls.service.js';
import { RoomsService } from '../application/services/rooms.service.js';
import { ExtendRoomDto, RoomExtensionResultDto } from './dto/room-extension.dto.js';
import { RoomIdParamsDto } from './dto/room.dto.js';

@ApiTags('rooms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@Controller('rooms')
export class RoomExtensionsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly host: HostControlsService,
    @Inject(ROOM_COMMAND_DELIVERY) private readonly delivery: RoomCommandDelivery,
  ) {}

  @Post(':roomId/extensions')
  @HttpCode(200)
  @ApiOkResponse({ type: RoomExtensionResultDto })
  async extend(
    @CurrentIdentity() actor: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: ExtendRoomDto,
  ): Promise<RoomExtensionResultDto> {
    const committed = await this.rooms.extend(actor.userId, params.roomId, body);
    await this.delivery.scheduleExpiry(params.roomId, committed.endsAt);
    await this.delivery.dispatchPending(params.roomId);
    const { providerStatus } = await this.host.deliveryStatus(params.roomId);
    return {
      ...committed,
      previousEndsAt: committed.previousEndsAt.toISOString(),
      endsAt: committed.endsAt.toISOString(),
      providerStatus,
    };
  }
}
