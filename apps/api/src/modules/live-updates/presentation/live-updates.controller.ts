import type { VerifiedAccessContext } from '../../auth/index.js';
import { Controller, Get, Headers, Query, Req, Res } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiServiceUnavailableResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { LIVE_SCOPES, type LiveScope } from '../domain/live-updates.port.js';
import type { Request, Response } from 'express';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { LiveUpdatesService } from '../application/live-updates.service.js';

export class LiveProtocolQueryDto {
  @ApiPropertyOptional({ enum: [1, 2], default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([1, 2])
  protocol?: number;
}
export class LiveUpdateEventDto {
  @ApiProperty({ enum: ['ready', 'reset', ...LIVE_SCOPES, 'heartbeat', 'renew', 'unavailable'] })
  scope!: 'ready' | 'reset' | LiveScope | 'heartbeat' | 'renew' | 'unavailable';
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Protocol2 only: opaque resource in an authorized private audience.',
  })
  resourceId?: string;
  @ApiPropertyOptional({ enum: ['membership', 'visibility'] }) kind?: 'membership' | 'visibility';
}
@ApiTags('live-updates')
@ApiExtraModels(LiveUpdateEventDto)
@ApiBearerAuth()
@Controller('me/live-updates')
export class LiveUpdatesController {
  constructor(private readonly updates: LiveUpdatesService) {}
  @Get()
  @ApiHeader({
    name: 'Last-Event-ID',
    required: false,
    description: 'Opaque account-bound recovery cursor (maximum 512 characters).',
  })
  @ApiOkResponse({
    description:
      'SSE frames: event: change, id: opaque cursor, data: JSON event. Heartbeats are comments; renewal closes the bounded response.',
    content: {
      'text/event-stream': { schema: { $ref: '#/components/schemas/LiveUpdateEventDto' } },
    },
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  async stream(
    @Headers('last-event-id') cursor: string | undefined,
    @Query() query: LiveProtocolQueryDto,
    @Req() request: Request & { verifiedAccess?: VerifiedAccessContext },
    @Res() response: Response,
  ) {
    const abort = new AbortController();
    const close = () => abort.abort();
    response.on('close', close);
    try {
      const frames = await this.updates.open(
        request.headers.authorization!.slice(7),
        cursor,
        abort.signal,
        query.protocol ?? 1,
        request.verifiedAccess,
      );
      response.status(200).set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'private, no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      for await (const frame of frames) {
        if (abort.signal.aborted) break;
        const text =
          frame.scope === 'heartbeat'
            ? ': keep-alive\n\n'
            : `${frame.id ? `id: ${frame.id}\n` : ''}event: change\ndata: ${JSON.stringify({ scope: frame.scope, ...(frame.resourceId ? { resourceId: frame.resourceId } : {}), ...(frame.kind ? { kind: frame.kind } : {}) })}\n\n`;
        if (!response.write(text)) {
          // A slow consumer cannot retain unbounded server buffers; reconnect resets safely.
          abort.abort();
          break;
        }
      }
    } catch (error) {
      if (!response.headersSent && !abort.signal.aborted) throw error;
      if (!abort.signal.aborted) response.write('event: change\ndata: {"scope":"unavailable"}\n\n');
    } finally {
      abort.abort();
      response.removeListener('close', close);
      if (response.headersSent && !response.writableEnded) response.end();
    }
  }
}
