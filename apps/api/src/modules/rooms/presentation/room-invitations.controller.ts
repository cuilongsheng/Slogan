import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { RoomInvitationsService } from '../application/services/room-invitations.service.js';
import { RoomIdParamsDto } from './dto/room.dto.js';
import {
  CreateRoomInvitationDto,
  DeclineRoomInvitationDto,
  RoomInvitationDto,
  RoomInvitationPageDto,
  RoomInvitationPageQueryDto,
  RoomInvitationParamsDto,
} from './dto/room-invitation.dto.js';

@ApiTags('room-invitations')
@ApiBearerAuth()
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiServiceUnavailableResponse({ type: ErrorResponseDto })
@Controller()
export class RoomInvitationsController {
  constructor(private readonly invitations: RoomInvitationsService) {}

  @Post('rooms/:roomId/invitations')
  @ApiCreatedResponse({ type: RoomInvitationDto })
  async create(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: CreateRoomInvitationDto,
  ) {
    return this.present(await this.invitations.create(identity.userId, params.roomId, body));
  }

  @Get('me/room-invitations')
  @ApiOkResponse({ type: RoomInvitationPageDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: RoomInvitationPageQueryDto,
  ) {
    const page = await this.invitations.list(identity.userId, query);
    return {
      ...page,
      items: page.items.map((item) => ({
        ...this.present(item),
        inviterDisplayName: item.inviterDisplayName,
        room: {
          ...item.room,
          startedAt: item.room.startedAt.toISOString(),
          endsAt: item.room.endsAt.toISOString(),
        },
      })),
    };
  }

  @Post('room-invitations/:invitationId/decline')
  @HttpCode(200)
  @ApiOkResponse({ type: RoomInvitationDto })
  async decline(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomInvitationParamsDto,
    @Body() body: DeclineRoomInvitationDto,
  ) {
    return this.present(
      await this.invitations.decline(identity.userId, params.invitationId, body.clientRequestId),
    );
  }

  private present(value: {
    id: string;
    roomId: string;
    inviterUserId: string;
    inviteeUserId: string;
    status: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }) {
    return {
      id: value.id,
      roomId: value.roomId,
      inviterUserId: value.inviterUserId,
      inviteeUserId: value.inviteeUserId,
      status: value.status,
      createdAt: value.createdAt.toISOString(),
      resolvedAt: value.resolvedAt?.toISOString() ?? null,
    };
  }
}
