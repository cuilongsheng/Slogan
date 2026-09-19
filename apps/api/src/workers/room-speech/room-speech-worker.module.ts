import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { ROOM_MEDIA_SOURCE, SpeechSafetyModule } from '../../modules/speech-safety/index.js';
import { RoomSpeechProcessingModule } from '../../modules/room-speech-processing/index.js';
import { LivekitRoomMediaSource } from './livekit-room-media-source.js';
import { RoomSpeechWorkerRunner } from './room-speech-worker.runner.js';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['apps/api/.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ObservabilityModule,
    DatabaseModule,
    RedisModule,
    SpeechSafetyModule,
    RoomSpeechProcessingModule,
  ],
  providers: [
    LivekitRoomMediaSource,
    RoomSpeechWorkerRunner,
    { provide: ROOM_MEDIA_SOURCE, useExisting: LivekitRoomMediaSource },
  ],
})
export class RoomSpeechWorkerModule {}
