import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { AppointmentsService } from '../application/services/appointments.service.js';
import type { AppointmentRecord } from '../domain/ports/appointment.repository.js';
import { ListRoomsQueryDto, RoomIdParamsDto } from './dto/room.dto.js';
import {
  AppointmentDto,
  AppointmentDetailDto,
  AppointmentListDto,
  CreateAppointmentDto,
  ReservationDto,
  ReservationVersionDto,
  ReserveAppointmentDto,
} from './dto/appointment.dto.js';
function present(room: AppointmentRecord): AppointmentDto {
  return {
    id: room.id,
    hostUserId: room.hostUserId,
    topic: room.topic,
    cefrLevel: room.cefrLevel,
    capacity: room.capacity,
    status: room.status,
    startsAt: room.startedAt.toISOString(),
    endsAt: room.endsAt.toISOString(),
    passwordProtected: room.passwordDigest !== null,
    memberCount: room.memberCount,
    reservedCount: room.reservedCount,
    availableCount: room.availableCount,
    reservation: room.reservation,
    visibility: room.visibility,
    sensitiveSpeechDetectionEnabled: room.sensitiveSpeechDetectionEnabled,
    postRoomKeywordsEnabled: room.postRoomKeywordsEnabled,
  };
}
function presentDetail(room: AppointmentRecord & { shareUrl: string }): AppointmentDetailDto {
  return { ...present(room), shareUrl: room.shareUrl };
}
@ApiTags('appointment-rooms')
@ApiBearerAuth()
@Controller('appointment-rooms')
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}
  @Post()
  @ApiCreatedResponse({ type: AppointmentDetailDto })
  async create(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: CreateAppointmentDto,
  ) {
    return presentDetail(await this.appointments.create(identity.userId, body));
  }
  @Get()
  @ApiOkResponse({ type: AppointmentListDto })
  async list(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Query() query: ListRoomsQueryDto,
  ) {
    const page = await this.appointments.list(identity.userId, query);
    return { items: page.items.map(present), nextCursor: page.nextCursor };
  }
  @Get(':roomId')
  @ApiOkResponse({ type: AppointmentDetailDto })
  async detail(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
  ) {
    return presentDetail(await this.appointments.detail(identity.userId, params.roomId));
  }
  @Post(':roomId/reservations')
  @ApiCreatedResponse({ type: ReservationDto })
  async reserve(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: ReserveAppointmentDto,
  ) {
    const r = await this.appointments.reserve(identity.userId, params.roomId, body);
    return { id: r.id, status: r.status, version: r.version };
  }
  @Post(':roomId/reservation-cancellations')
  @HttpCode(200)
  @ApiOkResponse({ type: ReservationDto })
  async cancelReservation(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
    @Body() body: ReservationVersionDto,
  ) {
    const r = await this.appointments.cancelReservation(
      identity.userId,
      params.roomId,
      body.expectedReservationVersion,
    );
    return { id: r.id, status: r.status, version: r.version };
  }
  @Post(':roomId/cancellations')
  @HttpCode(200)
  @ApiOkResponse({ type: AppointmentDto })
  async cancelRoom(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: RoomIdParamsDto,
  ) {
    return present(await this.appointments.cancelRoom(identity.userId, params.roomId));
  }
}
