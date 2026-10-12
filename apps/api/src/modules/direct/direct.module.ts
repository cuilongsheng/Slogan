import { Module } from '@nestjs/common';
import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { LivekitModule } from '../../infrastructure/livekit/livekit.module.js';
import { DirectService } from './application/direct.service.js';
import { DIRECT_REPOSITORY } from './domain/direct.js';
import { PrismaDirectRepository } from './infrastructure/prisma-direct.repository.js';
import { DirectController } from './presentation/direct.controller.js';
@Module({
  imports: [RedisModule, LivekitModule],
  controllers: [DirectController],
  providers: [
    DirectService,
    PrismaDirectRepository,
    { provide: DIRECT_REPOSITORY, useExisting: PrismaDirectRepository },
  ],
  exports: [DirectService],
})
export class DirectModule {}
