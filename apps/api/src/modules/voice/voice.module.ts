import { Module } from '@nestjs/common';
import { HostControlsController } from '../rooms/index.js';
import { RoomExtensionsController } from '../rooms/index.js';
import { ROOM_COMMAND_DELIVERY } from '../rooms/index.js';
import { RoomsModule } from '../rooms/index.js';
import { LivekitModule } from '../../infrastructure/livekit/livekit.module.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { VoiceService } from './application/services/voice.service.js';
import { RealtimeRunner } from './infrastructure/realtime-runner.service.js';
import { VoiceController, LivekitWebhookController } from './presentation/voice.controller.js';
@Module({
  imports: [RoomsModule, LivekitModule, RedisModule, ObservabilityModule],
  providers: [
    VoiceService,
    RealtimeRunner,
    { provide: ROOM_COMMAND_DELIVERY, useExisting: VoiceService },
  ],
  controllers: [
    VoiceController,
    LivekitWebhookController,
    HostControlsController,
    RoomExtensionsController,
  ],
})
export class VoiceModule {}
