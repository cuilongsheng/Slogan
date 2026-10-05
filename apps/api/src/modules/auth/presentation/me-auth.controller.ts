import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { PhoneAuthService } from '../application/services/phone-auth.service.js';
import {
  AccountDeleteProviderParamsDto,
  LinkResultDto,
  LoginMethodsResponseDto,
  OAuthDeleteProofDto,
  OAuthLinkDto,
  PhoneChallengeDto,
  PhoneChallengeResponseDto,
  PhoneConfirmDto,
  StepUpProofDto,
} from './dto/phone-auth.dto.js';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeAuthController {
  constructor(private readonly phone: PhoneAuthService) {}

  @Get('login-methods')
  @ApiOkResponse({ type: LoginMethodsResponseDto })
  async methods(
    @CurrentIdentity() identity: CurrentAccessIdentity,
  ): Promise<LoginMethodsResponseDto> {
    const methods = await this.phone.loginMethods(identity.userId);
    return {
      methods: methods.map((method) => ({
        type: method.type,
        verifiedAt: method.verifiedAt?.toISOString() ?? null,
        ...(method.origin ? { origin: method.origin } : {}),
        ...(method.mask ? { mask: method.mask } : {}),
      })),
    };
  }

  @Post('login-methods/phone/challenges')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PhoneChallengeResponseDto })
  async phoneChallenge(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PhoneChallengeDto,
    @Req() request: Request,
  ): Promise<PhoneChallengeResponseDto> {
    const challenge = await this.phone.requestLinkChallenge({
      userId: identity.userId,
      ...body,
      source: request.ip ?? 'unknown',
    });
    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAt: challenge.resendAt.toISOString(),
    };
  }

  @Post('login-methods/phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LinkResultDto })
  confirmPhone(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PhoneConfirmDto,
  ): Promise<LinkResultDto> {
    return this.phone.confirmPhoneLink({ userId: identity.userId, ...body });
  }

  @Post('login-methods/oauth/:provider/link')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LinkResultDto })
  linkOAuth(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: AccountDeleteProviderParamsDto,
    @Body() body: OAuthLinkDto,
  ): Promise<LinkResultDto> {
    return this.phone.linkOAuth(
      identity.userId,
      params.provider === 'google' ? 'GOOGLE' : 'WECHAT',
      body,
    );
  }

  @Post('account/deletion/proofs/phone/challenges')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: PhoneChallengeResponseDto })
  async deletePhoneChallenge(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PhoneChallengeDto,
    @Req() request: Request,
  ): Promise<PhoneChallengeResponseDto> {
    const challenge = await this.phone.requestDeletePhoneChallenge({
      userId: identity.userId,
      ...body,
      source: request.ip ?? 'unknown',
    });
    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAt: challenge.resendAt.toISOString(),
    };
  }

  @Post('account/deletion/proofs/phone/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StepUpProofDto })
  deletePhoneProof(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PhoneConfirmDto,
  ): Promise<StepUpProofDto> {
    return this.phone.confirmDeletePhoneProof({ userId: identity.userId, ...body });
  }

  @Post('account/deletion/proofs/oauth/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: StepUpProofDto })
  deleteOAuthProof(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: AccountDeleteProviderParamsDto,
    @Body() body: OAuthDeleteProofDto,
  ): Promise<StepUpProofDto> {
    return this.phone.createDeleteOAuthProof(
      identity.userId,
      params.provider === 'google' ? 'GOOGLE' : 'WECHAT',
      body,
    );
  }
}
