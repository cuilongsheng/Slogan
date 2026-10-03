import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Headers,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiServiceUnavailableResponse,
  ApiConsumes,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { VoiceService } from '../application/services/voice.service.js';
import { RealtimeError } from '../domain/errors/realtime.error.js';
import { RealtimeCredentialDto, RealtimeMemberDto, RemovedRoomMemberDto } from './dto/voice.dto.js';

@ApiTags('voice')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiNotFoundResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiServiceUnavailableResponse({ type: ErrorResponseDto })
@Controller('rooms')
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}
  @Post(':roomId/realtime-credentials')
  @HttpCode(200)
  @ApiOkResponse({ type: RealtimeCredentialDto })
  credentials(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @CurrentIdentity() identity: CurrentAccessIdentity,
  ) {
    return this.voice.credentials(roomId, identity.userId);
  }
  @Get(':roomId/members')
  @ApiOkResponse({ type: [RealtimeMemberDto] })
  members(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @CurrentIdentity() identity: CurrentAccessIdentity,
  ) {
    return this.voice.members(roomId, identity.userId);
  }
  @Get(':roomId/removed-members')
  @ApiOkResponse({ type: [RemovedRoomMemberDto] })
  removedMembers(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @CurrentIdentity() identity: CurrentAccessIdentity,
  ) {
    return this.voice.removedMembers(roomId, identity.userId);
  }
}

@ApiTags('voice')
@Controller('webhooks')
export class LivekitWebhookController {
  constructor(private readonly voice: VoiceService) {}
  @Public()
  @Post('livekit')
  @HttpCode(204)
  @ApiConsumes('application/webhook+json')
  @ApiBody({
    schema: { type: 'object', additionalProperties: true },
    description: 'LiveKit signed webhook; verification uses the original bytes',
  })
  @ApiHeader({
    name: 'Authorization',
    required: true,
    description: 'Provider JWT containing the body SHA-256, not a user access token',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  async receive(@Req() req: Request, @Headers('authorization') authorization?: string) {
    if (!authorization || !req.is('application/webhook+json') || !Buffer.isBuffer(req.body))
      throw new RealtimeError('REALTIME_WEBHOOK_INVALID');
    await this.voice.webhook(req.body.toString('utf8'), authorization);
  }
}
