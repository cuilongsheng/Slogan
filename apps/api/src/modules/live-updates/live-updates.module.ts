import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { LiveUpdatesInterceptor } from './application/live-updates.interceptor.js';
import { ApiExtraModels } from '@nestjs/swagger';
import { AuthModule } from '../auth/auth.module.js';
import { SocialModule } from '../social/index.js';
import { LIVE_UPDATES_STORE } from './domain/live-updates.port.js';
import { RedisLiveUpdatesStore } from './infrastructure/redis-live-updates.store.js';
import { LiveUpdatesService } from './application/live-updates.service.js';
import {
  LiveUpdatesController,
  LiveUpdateEventDto,
} from './presentation/live-updates.controller.js';
@ApiExtraModels(LiveUpdateEventDto)
@Module({
  imports: [AuthModule, SocialModule, ObservabilityModule],
  controllers: [LiveUpdatesController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LiveUpdatesInterceptor },
    LiveUpdatesService,
    RedisLiveUpdatesStore,
    { provide: LIVE_UPDATES_STORE, useExisting: RedisLiveUpdatesStore },
  ],
  exports: [LiveUpdatesService],
})
export class LiveUpdatesModule {}
