import { Module } from '@nestjs/common';

import { ProfilesService } from './application/services/profiles.service.js';
import { ProfilePolicy } from './domain/policies/profile.policy.js';
import { PROFILE_REPOSITORY } from './domain/ports/profile.repository.js';
import { PrismaProfileRepository } from './infrastructure/prisma-profile.repository.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [MeController],
  providers: [
    ProfilesService,
    ProfilePolicy,
    PrismaProfileRepository,
    { provide: PROFILE_REPOSITORY, useExisting: PrismaProfileRepository },
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
