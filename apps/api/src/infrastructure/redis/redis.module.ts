import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module.js';
import { RealtimeQueue } from './realtime-queue.service.js';
import { SocialPresenceStore } from './social-presence.service.js';
import { SOCIAL_PRESENCE } from '../../modules/social/domain/ports/presence.port.js';
import { ASSISTANCE_COORDINATOR } from '../../modules/assistance/contracts.js';
import { AssistanceCoordinatorStore } from './assistance-coordinator.service.js';
import { RoomSpeechReadinessStore } from './room-speech-readiness.service.js';
@Module({
  imports: [ObservabilityModule],
  providers: [
    RealtimeQueue,
    SocialPresenceStore,
    AssistanceCoordinatorStore,
    RoomSpeechReadinessStore,
    { provide: SOCIAL_PRESENCE, useExisting: SocialPresenceStore },
    { provide: ASSISTANCE_COORDINATOR, useExisting: AssistanceCoordinatorStore },
  ],
  exports: [RealtimeQueue, SOCIAL_PRESENCE, ASSISTANCE_COORDINATOR, RoomSpeechReadinessStore],
})
export class RedisModule {}
