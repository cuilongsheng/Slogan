import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import {
  BackofficePermissionGuard,
  type BackofficeRequest,
  RequireBackofficePermission,
} from '../../backoffice/index.js';
import { RoomSpeechSafetyService } from '../application/services/room-speech-safety.service.js';
import {
  CursorPageQueryDto,
  RoomSafetyAlertParamsDto,
  RoomSpeechAlertPageDto,
  SafetyCapabilityIncidentPageDto,
  SafetyCapabilityIncidentQueryDto,
} from './dto/room-speech-safety.dto.js';

@ApiTags('room-safety')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@Controller('rooms/:roomId/safety-alerts')
export class RoomSpeechAlertsController {
  constructor(private readonly service: RoomSpeechSafetyService) {}

  @Get()
  @ApiOperation({ description: 'Lists retained minimal safety alerts for the current room host.' })
  @ApiOkResponse({ type: RoomSpeechAlertPageDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomSafetyAlertParamsDto,
    @Query() query: CursorPageQueryDto,
  ) {
    const page = await this.service.listHostAlerts(
      identity.userId,
      params.roomId,
      query.cursor,
      query.limit ?? 20,
    );
    return {
      items: page.items.map((item) => ({
        ...item,
        firstOccurredAt: item.firstOccurredAt.toISOString(),
        lastOccurredAt: item.lastOccurredAt.toISOString(),
        noticeCode: 'REQUIRES_HUMAN_REVIEW',
      })),
      nextCursor: page.nextCursor,
    };
  }
}

@ApiTags('backoffice-safety')
@ApiBearerAuth()
@UseGuards(BackofficePermissionGuard)
@RequireBackofficePermission('SAFETY_CAPABILITY_INCIDENTS_READ')
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiBadRequestResponse({ type: ErrorResponseDto })
@Controller('backoffice/safety-capability-incidents')
export class SafetyCapabilityIncidentsController {
  constructor(private readonly service: RoomSpeechSafetyService) {}

  @Get()
  @ApiOperation({
    description:
      'Requires PLATFORM_ADMIN, SAFETY_OFFICER or AUDITOR. OPERATIONS_ANALYST alone is denied.',
  })
  @ApiOkResponse({ type: SafetyCapabilityIncidentPageDto })
  async list(@Query() query: SafetyCapabilityIncidentQueryDto, @Req() request: BackofficeRequest) {
    const page = await this.service.listIncidents({
      actorUserId: request.user.userId,
      actorRoles: request.backofficeRoles ?? [],
      ...(request.id ? { requestId: request.id } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.component ? { component: query.component } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
      limit: query.limit ?? 20,
    });
    return {
      items: page.items.map((item) => ({
        ...item,
        startedAt: item.startedAt.toISOString(),
        lastObservedAt: item.lastObservedAt.toISOString(),
        recoveredAt: item.recoveredAt?.toISOString() ?? null,
      })),
      nextCursor: page.nextCursor,
    };
  }
}
