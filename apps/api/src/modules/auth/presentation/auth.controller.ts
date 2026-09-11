import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiGatewayTimeoutResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CurrentIdentity,
  type CurrentAccessIdentity,
} from '../../../common/decorators/current-identity.decorator.js';
import { Public } from '../../../common/decorators/public.decorator.js';
import { AuthRateLimitGuard } from '../../../common/guards/auth-rate-limit.guard.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { AuthService } from '../application/services/auth.service.js';
import { SessionService } from '../application/services/session.service.js';
import {
  OAuthExchangeDto,
  OAuthExchangeResponseDto,
  OAuthProviderParamsDto,
  RefreshTokenDto,
  TokenPairDto,
} from './dto/auth.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('oauth/:provider/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: OAuthExchangeResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  @ApiGatewayTimeoutResponse({ type: ErrorResponseDto })
  async exchange(
    @Param() params: OAuthProviderParamsDto,
    @Body() body: OAuthExchangeDto,
  ): Promise<OAuthExchangeResponseDto> {
    const result = await this.auth.exchange(
      params.provider === 'google' ? 'GOOGLE' : 'WECHAT',
      body,
    );
    return {
      userId: result.userId,
      created: result.created,
      onboardingState: result.onboardingState,
      tokens: {
        ...result.tokens,
        refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt.toISOString(),
      },
      ...(result.suggestedProfile === undefined
        ? {}
        : { suggestedProfile: result.suggestedProfile }),
    };
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenPairDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async refresh(@Body() body: RefreshTokenDto): Promise<TokenPairDto> {
    const tokens = await this.sessions.refresh(body.refreshToken);
    return { ...tokens, refreshTokenExpiresAt: tokens.refreshTokenExpiresAt.toISOString() };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async logout(@CurrentIdentity() identity: CurrentAccessIdentity): Promise<void> {
    await this.sessions.revoke(identity);
  }
}
