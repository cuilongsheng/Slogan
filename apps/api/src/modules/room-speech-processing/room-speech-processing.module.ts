import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { PostRoomLearningModule } from '../post-room-learning/index.js';
import { SpeechSafetyModule } from '../speech-safety/index.js';
import { OperationsModule } from '../operations/index.js';
import { RoomSpeechProcessingService } from './application/room-speech-processing.service.js';
import { ROOM_SPEECH_PROCESSING_REPOSITORY } from './domain/room-speech-processing.repository.js';
import { PrismaRoomSpeechProcessingRepository } from './infrastructure/prisma-room-speech-processing.repository.js';

@Module({
  imports: [SpeechSafetyModule, PostRoomLearningModule, ObservabilityModule, OperationsModule],
  providers: [
    RoomSpeechProcessingService,
    PrismaRoomSpeechProcessingRepository,
    {
      provide: ROOM_SPEECH_PROCESSING_REPOSITORY,
      useExisting: PrismaRoomSpeechProcessingRepository,
    },
  ],
  exports: [RoomSpeechProcessingService],
})
export class RoomSpeechProcessingModule {}
