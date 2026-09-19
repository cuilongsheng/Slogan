import { Module } from '@nestjs/common';
import { LivekitModule } from '../../infrastructure/livekit/livekit.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { SttProviderModule } from '../../infrastructure/stt/stt-provider.module.js';
import { BackofficeModule } from '../backoffice/index.js';
import { RoomSpeechSafetyService } from './application/services/room-speech-safety.service.js';
import { RoomSpeechRiskPolicy } from './domain/policies/room-speech-risk.policy.js';
import { ROOM_SPEECH_COORDINATOR } from './domain/ports/room-speech-coordinator.port.js';
import { ROOM_SPEECH_REPOSITORY } from './domain/ports/room-speech.repository.js';
import { PrismaRoomSpeechRepository } from './infrastructure/prisma-room-speech.repository.js';
import { RedisRoomSpeechCoordinator } from './infrastructure/redis-room-speech-coordinator.js';
import { ROOM_SPEECH_TRANSCRIBER } from './domain/ports/room-speech-transcriber.port.js';
import { WindowedRoomSpeechTranscriber } from './infrastructure/windowed-room-speech-transcriber.js';
import {
  RoomSpeechAlertsController,
  SafetyCapabilityIncidentsController,
} from './presentation/room-speech-safety.controller.js';

@Module({
  imports: [SttProviderModule, LivekitModule, BackofficeModule, ObservabilityModule],
  controllers: [RoomSpeechAlertsController, SafetyCapabilityIncidentsController],
  providers: [
    RoomSpeechSafetyService,
    RoomSpeechRiskPolicy,
    PrismaRoomSpeechRepository,
    RedisRoomSpeechCoordinator,
    WindowedRoomSpeechTranscriber,
    { provide: ROOM_SPEECH_REPOSITORY, useExisting: PrismaRoomSpeechRepository },
    { provide: ROOM_SPEECH_COORDINATOR, useExisting: RedisRoomSpeechCoordinator },
    { provide: ROOM_SPEECH_TRANSCRIBER, useExisting: WindowedRoomSpeechTranscriber },
  ],
  exports: [
    RoomSpeechSafetyService,
    ROOM_SPEECH_REPOSITORY,
    ROOM_SPEECH_COORDINATOR,
    ROOM_SPEECH_TRANSCRIBER,
  ],
})
export class SpeechSafetyModule {}
