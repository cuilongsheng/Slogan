import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard.js';
import { AvatarController } from './presentation/avatar.controller.js';
import { AvatarService } from './application/services/avatar.service.js';
import { PrismaAvatarRepository } from './infrastructure/prisma-avatar.repository.js';
import { PngAvatarImage } from './infrastructure/avatar-image.js';
import { AVATAR_IMAGE, AVATAR_REPOSITORY } from './domain/ports/avatar.repository.js';
import { Module } from '@nestjs/common';

import { ProfilesService } from './application/services/profiles.service.js';
import { ProfilePolicy } from './domain/policies/profile.policy.js';
import { PROFILE_REPOSITORY } from './domain/ports/profile.repository.js';
import { PrismaProfileRepository } from './infrastructure/prisma-profile.repository.js';
import { MeController } from './presentation/me.controller.js';

@Module({
  controllers: [MeController, AvatarController],
  providers: [
    AvatarService,
    PrismaAvatarRepository,
    AuthRateLimitGuard,
    PngAvatarImage,
    { provide: AVATAR_IMAGE, useExisting: PngAvatarImage },
    { provide: AVATAR_REPOSITORY, useExisting: PrismaAvatarRepository },
    ProfilesService,
    ProfilePolicy,
    PrismaProfileRepository,
    { provide: PROFILE_REPOSITORY, useExisting: PrismaProfileRepository },
  ],
  exports: [ProfilesService],
})
export class ProfilesModule {}
