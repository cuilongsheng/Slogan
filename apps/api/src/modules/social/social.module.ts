import { Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { SocialService } from './application/services/social.service.js';
import { SOCIAL_REPOSITORY } from './domain/ports/social.repository.js';
import { SocialPolicy } from './domain/policies/social.policy.js';
import { PrismaSocialRepository } from './infrastructure/prisma-social.repository.js';
import { SocialController } from './presentation/social.controller.js';

@Module({
  imports: [RedisModule],
  controllers: [SocialController],
  providers: [
    SocialService,
    SocialPolicy,
    PrismaSocialRepository,
    { provide: SOCIAL_REPOSITORY, useExisting: PrismaSocialRepository },
  ],
  exports: [SocialService],
})
export class SocialModule {}
