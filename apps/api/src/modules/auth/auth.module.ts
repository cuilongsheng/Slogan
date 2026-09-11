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
import { SessionService } from './application/services/session.service.js';
import { AUTH_REPOSITORY } from './domain/ports/auth.repository.js';
import { OAUTH_PROVIDER_REGISTRY } from './domain/ports/oauth-provider.port.js';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository.js';
import { AuthController } from './presentation/auth.controller.js';

@Module({
  imports: [JwtModule.register({}), ProfilesModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    AuthRateLimitGuard,
    PrismaAuthRepository,
    GoogleOAuthAdapter,
    WechatOAuthAdapter,
    DefaultOAuthProviderRegistry,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    { provide: OAUTH_PROVIDER_REGISTRY, useExisting: DefaultOAuthProviderRegistry },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
