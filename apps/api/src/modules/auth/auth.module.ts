import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenGuard } from '../../common/guards/access-token.guard.js';
import { AuthRateLimitGuard } from '../../common/guards/auth-rate-limit.guard.js';
import { DefaultOAuthProviderRegistry } from '../../infrastructure/oauth/oauth-provider.registry.js';
import { GoogleOAuthAdapter } from '../../infrastructure/oauth/google-oauth.adapter.js';
import { WechatOAuthAdapter } from '../../infrastructure/oauth/wechat-oauth.adapter.js';
import { ProfilesModule } from '../profiles/index.js';
import { AuthService } from './application/services/auth.service.js';
import { PhoneAuthService } from './application/services/phone-auth.service.js';
import { SessionService } from './application/services/session.service.js';
import { AUTH_REPOSITORY } from './domain/ports/auth.repository.js';
import { PHONE_CHALLENGE_STORE } from './domain/ports/phone-challenge.store.js';
import { SMS_PROVIDER } from './domain/ports/sms-provider.port.js';
import { HttpSmsAdapter } from './infrastructure/http-sms.adapter.js';
import { OAUTH_PROVIDER_REGISTRY } from './domain/ports/oauth-provider.port.js';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository.js';
import { RedisPhoneChallengeStore } from './infrastructure/redis-phone-challenge.store.js';
import { AuthController } from './presentation/auth.controller.js';
import { MeAuthController } from './presentation/me-auth.controller.js';

@Module({
  imports: [JwtModule.register({}), ProfilesModule],
  controllers: [AuthController, MeAuthController],
  providers: [
    AuthService,
    PhoneAuthService,
    SessionService,
    AuthRateLimitGuard,
    PrismaAuthRepository,
    RedisPhoneChallengeStore,
    HttpSmsAdapter,
    GoogleOAuthAdapter,
    WechatOAuthAdapter,
    DefaultOAuthProviderRegistry,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    { provide: PHONE_CHALLENGE_STORE, useExisting: RedisPhoneChallengeStore },
    { provide: SMS_PROVIDER, useExisting: HttpSmsAdapter },
    { provide: OAUTH_PROVIDER_REGISTRY, useExisting: DefaultOAuthProviderRegistry },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
  exports: [SessionService, PhoneAuthService, PHONE_CHALLENGE_STORE],
})
export class AuthModule {}
