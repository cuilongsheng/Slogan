import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { EmailAuthService } from '../application/services/email-auth.service.js';
import { OAuthExchangeResponseDto, OAuthProviderParamsDto } from './dto/auth.dto.js';
import {
  OAuthDeleteProofDto,
  PhoneChallengeDto,
  PhoneChallengeResponseDto,
  PhoneConfirmDto,
  StepUpProofDto,
} from './dto/phone-auth.dto.js';
import {
  EmailRegistrationDto,
  EmailResendDto,
  EmailTokenDto,
  EmailLoginDto,
  EmailResetRequestDto,
  EmailResetDto,
  EmailLinkDto,
  EmailDeletionProofDto,
  EmailEnrollmentResponseDto,
  EmailResendResponseDto,
  EmailVerifiedResponseDto,
  EmailAcceptedResponseDto,
} from './dto/email-auth.dto.js';

@ApiTags('email-auth')
@ApiBadRequestResponse({ type: ErrorResponseDto })
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@ApiForbiddenResponse({ type: ErrorResponseDto })
@ApiConflictResponse({ type: ErrorResponseDto })
@ApiTooManyRequestsResponse({ type: ErrorResponseDto })
@ApiServiceUnavailableResponse({ type: ErrorResponseDto })
@Controller()
export class EmailAuthController {
  constructor(private readonly auth: EmailAuthService) {}
  @Public()
  @Post('auth/email/registrations')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: EmailEnrollmentResponseDto })
  register(@Body() body: EmailRegistrationDto, @Req() req: Request) {
    return this.auth.register(body, req.ip ?? 'unknown');
  }
  @Public()
  @Post('auth/email/verifications/resend')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: EmailResendResponseDto })
  resend(@Body() body: EmailResendDto, @Req() req: Request) {
    return this.auth.resend(body.managementToken, req.ip ?? 'unknown');
  }
  @Public()
  @Post('auth/email/verifications/confirm')
  @HttpCode(200)
  @ApiOkResponse({ type: EmailVerifiedResponseDto })
  confirm(@Body() body: EmailTokenDto, @Req() req: Request) {
    return this.auth.confirm(body.token, req.ip ?? 'unknown');
  }
  @Public()
  @Post('auth/password/exchange')
  @HttpCode(200)
  @ApiOkResponse({ type: OAuthExchangeResponseDto })
  login(@Body() body: EmailLoginDto, @Req() req: Request) {
    return this.auth.login(body, req.ip ?? 'unknown');
  }
  @Public()
  @Post('auth/password/reset-requests')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: EmailAcceptedResponseDto })
  requestReset(@Body() body: EmailResetRequestDto, @Req() req: Request) {
    return this.auth.requestReset(body.email, req.ip ?? 'unknown');
  }
  @Public()
  @Post('auth/password/resets')
  @HttpCode(204)
  @ApiNoContentResponse()
  reset(@Body() body: EmailResetDto, @Req() req: Request) {
    return this.auth.reset(body.token, body.password, req.ip ?? 'unknown');
  }
  @ApiBearerAuth()
  @Post('me/login-methods/email/proofs/oauth/:provider')
  @HttpCode(200)
  @ApiOkResponse({ type: StepUpProofDto })
  oauth(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Param() params: OAuthProviderParamsDto,
    @Body() body: OAuthDeleteProofDto,
    @Req() req: Request,
  ) {
    return this.auth.oauthProof(
      identity,
      params.provider === 'google' ? 'GOOGLE' : 'WECHAT',
      body,
      req.ip ?? 'unknown',
    );
  }
  @ApiBearerAuth()
  @Post('me/login-methods/email/proofs/phone/challenges')
  @HttpCode(200)
  @ApiOkResponse({ type: PhoneChallengeResponseDto })
  async phoneChallenge(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PhoneChallengeDto,
    @Req() req: Request,
  ) {
    const r = await this.auth.phoneChallenge(identity, body, req.ip ?? 'unknown');
    return { ...r, expiresAt: r.expiresAt.toISOString(), resendAt: r.resendAt.toISOString() };
  }
  @ApiBearerAuth()
  @Post('me/login-methods/email/proofs/phone/confirm')
  @HttpCode(200)
  @ApiOkResponse({ type: StepUpProofDto })
  phoneProof(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: PhoneConfirmDto,
    @Req() req: Request,
  ) {
    return this.auth.phoneProof(identity, body, req.ip ?? 'unknown');
  }
  @ApiBearerAuth()
  @Post('me/login-methods/email/requests')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: EmailEnrollmentResponseDto })
  link(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: EmailLinkDto,
    @Req() req: Request,
  ) {
    return this.auth.register(body, req.ip ?? 'unknown', new Date(), {
      ...identity,
      proof: body.proof,
      clientRequestId: body.clientRequestId,
    });
  }
  @ApiBearerAuth()
  @Post('me/login-methods/email/confirm')
  @HttpCode(200)
  @ApiOkResponse({ type: EmailVerifiedResponseDto })
  linkConfirm(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: EmailTokenDto,
    @Req() req: Request,
  ) {
    return this.auth.confirm(body.token, req.ip ?? 'unknown', new Date(), identity);
  }
  @ApiBearerAuth()
  @Post('me/account/deletion/proofs/password')
  @HttpCode(200)
  @ApiOkResponse({ type: StepUpProofDto })
  deletionProof(
    @CurrentIdentity() identity: CurrentAccessIdentity,
    @Body() body: EmailDeletionProofDto,
    @Req() req: Request,
  ) {
    return this.auth.passwordProof(
      identity,
      body.password,
      body.clientRequestId,
      req.ip ?? 'unknown',
    );
  }
}
