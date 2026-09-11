import { Body, Controller, Get, Put } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { ProfilesService } from '../application/services/profiles.service.js';
import type { ProfileRecord } from '../domain/entities/profile.js';
import { MeResponseDto, ProfileDto, PutProfileDto } from './dto/profile.dto.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @ApiOkResponse({ type: MeResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async getMe(@CurrentIdentity() identity: CurrentAccessIdentity): Promise<MeResponseDto> {
    const profile = await this.profiles.get(identity.userId);
    return {
      userId: identity.userId,
      onboardingState: await this.profiles.getOnboardingState(identity.userId),
      profile: profile === null ? null : this.toDto(profile),
    };
  }

  @Put('profile')
  @ApiOkResponse({ type: MeResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async putProfile(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PutProfileDto,
  ): Promise<MeResponseDto> {
    const profile = await this.profiles.put(identity.userId, body);
    return {
      userId: identity.userId,
      onboardingState: await this.profiles.getOnboardingState(identity.userId),
      profile: this.toDto(profile),
    };
  }

  private toDto(profile: ProfileRecord): ProfileDto {
    return { ...profile, completedAt: profile.completedAt.toISOString() };
  }
}
