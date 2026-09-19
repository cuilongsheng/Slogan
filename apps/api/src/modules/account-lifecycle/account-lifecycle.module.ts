import { Module } from '@nestjs/common';

import { RedisModule } from '../../infrastructure/redis/redis.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AccountLifecycleService } from './application/services/account-lifecycle.service.js';
import { ACCOUNT_LIFECYCLE_REPOSITORY } from './domain/ports/account-lifecycle.repository.js';
import { PrismaAccountLifecycleRepository } from './infrastructure/prisma-account-lifecycle.repository.js';
import { AccountLifecycleController } from './presentation/account-lifecycle.controller.js';

@Module({
  imports: [AuthModule, RedisModule],
  controllers: [AccountLifecycleController],
  providers: [
    AccountLifecycleService,
    PrismaAccountLifecycleRepository,
    { provide: ACCOUNT_LIFECYCLE_REPOSITORY, useExisting: PrismaAccountLifecycleRepository },
  ],
  exports: [AccountLifecycleService],
})
export class AccountLifecycleModule {}
