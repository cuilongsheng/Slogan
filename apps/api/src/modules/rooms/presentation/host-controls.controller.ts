import { Body, Controller, HttpCode, Inject, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { AppError } from '../../../common/errors/app-error.js';
import {
  HostControlsService,
  ROOM_COMMAND_DELIVERY,
  type HostAction,
  type RoomCommandDelivery,
} from '../application/services/host-controls.service.js';
import {
  HostActionResultDto,
  LeaveRoomDto,
  MemberActionParamsDto,
  MemberGenerationDto,
} from './dto/host-controls.dto.js';
import { RoomIdParamsDto } from './dto/room.dto.js';
@ApiTags('rooms')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({
  type: ErrorResponseDto,
  description:
    'ROOM_HOST_REQUIRED, ROOM_MEMBER_NOT_ACTIVE, ROOM_INVITATION_REQUIRED or eligibility denied',
})
@ApiConflictResponse({
  type: ErrorResponseDto,
  description:
    'ROOM_OPERATION_CONFLICT, ROOM_ENDED, ROOM_FULL or ROOM_HOST_RECONNECTING (details.retryAt)',
})
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation error or ROOM_SUCCESSOR_INVALID',
})
@ApiNotFoundResponse({ type: ErrorResponseDto })
@Controller('rooms')
export class HostControlsController {
  constructor(
    private readonly host: HostControlsService,
    @Inject(ROOM_COMMAND_DELIVERY) private readonly delivery: RoomCommandDelivery,
  ) {}
  @Post(':roomId/leave')
  @HttpCode(200)
  @ApiOkResponse({ type: HostActionResultDto })
  leave(
    @CurrentIdentity() actor: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: LeaveRoomDto,
  ) {
    return this.leaveCommitted(params.roomId, actor.userId, body);
  }
  private async leaveCommitted(roomId: string, userId: string, body: LeaveRoomDto) {
    const committed = await this.host.execute(roomId, userId, { kind: 'leave', ...body });
    // Durable commands are recovered by the runner. Provider I/O is not part of leaving.
    return { ...committed, ...(await this.host.deliveryStatus(roomId)) };
  }
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description:
      'REALTIME_PROVIDER_UNAVAILABLE. details contains the committed operation with providerStatus=UNAVAILABLE; do not assume the transaction rolled back.',
  })
  @Post(':roomId/members/:membershipId/removals')
  @HttpCode(200)
  @ApiOkResponse({ type: HostActionResultDto })
  remove(
    @CurrentIdentity() actor: CurrentAccessIdentity,
    @Param() params: MemberActionParamsDto,
    @Body() body: MemberGenerationDto,
  ) {
    return this.run(params.roomId, actor.userId, {
      kind: 'remove',
      targetId: params.membershipId,
      ...body,
    });
  }
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description:
      'REALTIME_PROVIDER_UNAVAILABLE. details contains the committed operation with providerStatus=UNAVAILABLE; do not assume the transaction rolled back.',
  })
  @Post(':roomId/members/:membershipId/invitations')
  @HttpCode(200)
  @ApiOkResponse({ type: HostActionResultDto })
  invite(
    @CurrentIdentity() actor: CurrentAccessIdentity,
    @Param() params: MemberActionParamsDto,
    @Body() body: MemberGenerationDto,
  ) {
    return this.run(params.roomId, actor.userId, {
      kind: 'invite',
      targetId: params.membershipId,
      ...body,
    });
  }
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description:
      'REALTIME_PROVIDER_UNAVAILABLE. details contains the committed operation with providerStatus=UNAVAILABLE; do not assume the transaction rolled back.',
  })
  @Post(':roomId/end')
  @HttpCode(200)
  @ApiOkResponse({ type: HostActionResultDto })
  end(@CurrentIdentity() actor: CurrentAccessIdentity, @Param() params: RoomIdParamsDto) {
    return this.run(params.roomId, actor.userId, { kind: 'end' });
  }
  private async run(roomId: string, userId: string, action: HostAction) {
    const committed = await this.host.execute(roomId, userId, action);
    await this.delivery.dispatchPending(roomId);
    const result = { ...committed, ...(await this.host.deliveryStatus(roomId)) };
    if (result.providerStatus === 'UNAVAILABLE')
      throw new AppError(
        'REALTIME_PROVIDER_UNAVAILABLE',
        'Operation committed; realtime cleanup is unavailable',
        503,
        result,
      );
    return result;
  }
}
