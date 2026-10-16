import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/errors/error-response.dto.js';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';
import { HealthRateLimitGuard } from './health-rate-limit.guard.js';

class LiveResponse {
  @ApiProperty({ enum: ['ok'] }) status!: 'ok';
}
class ReadyResponse {
  @ApiProperty({ enum: ['ready', 'not_ready'] }) status!: 'ready' | 'not_ready';
}

@ApiTags('health')
@ApiTooManyRequestsResponse({ type: ErrorResponseDto })
@Public()
@Controller('health')
@UseGuards(HealthRateLimitGuard)
export class HealthController {
  constructor(private readonly health: HealthService) {}
  @Get('live')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: LiveResponse })
  live(): LiveResponse {
    return { status: 'ok' };
  }
  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ReadyResponse })
  @ApiServiceUnavailableResponse({ type: ReadyResponse })
  async ready(@Res({ passthrough: true }) response: Response): Promise<ReadyResponse> {
    const ready = await this.health.ready();
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'not_ready' };
  }
}
