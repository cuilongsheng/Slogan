import { Module } from '@nestjs/common';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { SpeechSafetyModule } from '../speech-safety/index.js';
import { PostRoomLearningService } from './application/post-room-learning.service.js';
import { KeywordCandidatePolicy } from './domain/policies/keyword-candidate.policy.js';
import { KEYWORD_CANDIDATE_STORE } from './domain/ports/keyword-candidate-store.port.js';
import { POST_ROOM_LEARNING_REPOSITORY } from './domain/ports/post-room-learning.repository.js';
import { PrismaPostRoomLearningRepository } from './infrastructure/prisma-post-room-learning.repository.js';
import { RedisKeywordCandidateStore } from './infrastructure/redis-keyword-candidate.store.js';
import { PostRoomLearningController } from './presentation/post-room-learning.controller.js';

@Module({
  imports: [RedisModule, ObservabilityModule, SpeechSafetyModule],
  controllers: [PostRoomLearningController],
  providers: [
    PostRoomLearningService,
    KeywordCandidatePolicy,
    PrismaPostRoomLearningRepository,
    RedisKeywordCandidateStore,
    { provide: POST_ROOM_LEARNING_REPOSITORY, useExisting: PrismaPostRoomLearningRepository },
    { provide: KEYWORD_CANDIDATE_STORE, useExisting: RedisKeywordCandidateStore },
  ],
  exports: [PostRoomLearningService],
})
export class PostRoomLearningModule {}
