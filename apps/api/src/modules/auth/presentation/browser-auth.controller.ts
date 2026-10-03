import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../../../common/decorators/public.decorator.js';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto.js';
import { AuthRateLimitGuard } from '../../../common/guards/auth-rate-limit.guard.js';
import type { Environment } from '../../../config/environment.js';
import { AuthError } from '../domain/errors/auth.error.js';
import { AuthService } from '../application/services/auth.service.js';
import { EmailAuthService } from '../application/services/email-auth.service.js';
import { SessionService } from '../application/services/session.service.js';
import { EmailLoginDto } from './dto/email-auth.dto.js';
import {
  BrowserOAuthExchangeResponseDto,
  BrowserTokenDto,
  OAuthExchangeDto,
} from './dto/auth.dto.js';

const REFRESH_COOKIE = 'slogan_web_refresh';
const COOKIE_PATH = '/v1/auth/web';

@ApiTags('auth')
@Controller('auth/web')
export class BrowserAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailAuth: EmailAuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('password/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: BrowserOAuthExchangeResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async exchangePassword(
    @Body() body: EmailLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserOAuthExchangeResponseDto> {
    this.requireOrigin(request);
    const result = await this.emailAuth.login(body, request.ip ?? 'unknown');
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return {
      userId: result.userId,
      created: result.created,
      onboardingState: result.onboardingState,
      accessToken: result.tokens.accessToken,
      accessTokenExpiresInSeconds: result.tokens.accessTokenExpiresInSeconds,
    };
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: BrowserOAuthExchangeResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async exchangeGoogle(
    @Body() body: OAuthExchangeDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserOAuthExchangeResponseDto> {
    const origin = this.requireOrigin(request);
    if (body.redirectUri !== origin) {
      throw new AuthError('AUTH_CODE_REJECTED', 'Browser OAuth origin does not match');
    }
    const result = await this.auth.exchange('GOOGLE', body);
    this.setRefreshCookie(response, result.tokens.refreshToken);
    return {
      userId: result.userId,
      created: result.created,
      onboardingState: result.onboardingState,
      accessToken: result.tokens.accessToken,
      accessTokenExpiresInSeconds: result.tokens.accessTokenExpiresInSeconds,
      ...(result.suggestedProfile === undefined
        ? {}
        : { suggestedProfile: result.suggestedProfile }),
    };
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: BrowserTokenDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BrowserTokenDto> {
    this.requireOrigin(request);
    const refreshToken = this.refreshCookie(request);
    if (!refreshToken) throw new AuthError('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
    try {
      const tokens = await this.sessions.refresh(refreshToken);
      this.setRefreshCookie(response, tokens.refreshToken);
      return {
        accessToken: tokens.accessToken,
        accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
      };
    } catch (error) {
      if (
        error instanceof AuthError &&
        ['REFRESH_TOKEN_INVALID', 'REFRESH_TOKEN_REUSED'].includes(error.code)
      ) {
        response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
      }
      throw error;
    }
  }

  @Public()
  @UseGuards(AuthRateLimitGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.requireOrigin(request);
    const refreshToken = this.refreshCookie(request);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
    if (!refreshToken) return;
    try {
      const tokens = await this.sessions.refresh(refreshToken);
      const identity = await this.sessions.verifyAccessToken(tokens.accessToken);
      await this.sessions.revoke(identity);
    } catch (error) {
      if (
        error instanceof AuthError &&
        ['REFRESH_TOKEN_INVALID', 'REFRESH_TOKEN_REUSED', 'ACCESS_TOKEN_INVALID'].includes(
          error.code,
        )
      ) {
        return;
      }
      throw error;
    }
  }

  private requireOrigin(request: Request): string {
    const origin = request.headers.origin;
    const oauthOrigins = this.config
      .get('GOOGLE_OAUTH_REDIRECT_URIS', { infer: true })
      ?.split(',')
      .map((value) => value.trim());
    const corsOrigins = this.config.get('CORS_ALLOWED_ORIGINS', { infer: true });
    if (
      !origin ||
      !oauthOrigins?.includes(origin) ||
      !corsOrigins.includes(origin) ||
      !['http:', 'https:'].includes(new URL(origin).protocol)
    ) {
      throw new AuthError('AUTH_CODE_REJECTED', 'Browser OAuth origin is not allowed');
    }
    return origin;
  }

  private refreshCookie(request: Request): string | null {
    const matches = request.headers.cookie
      ?.split(';')
      .map((cookie) => cookie.trim())
      .filter((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`));
    if (matches?.length !== 1) return null;
    const value = matches[0]?.slice(REFRESH_COOKIE.length + 1);
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  }

  private setRefreshCookie(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
      path: COOKIE_PATH,
    };
  }
}
