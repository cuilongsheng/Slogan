import { PreviewAccountsService } from './application/services/preview-accounts.service.js';
import { PrismaPreviewAccountsRepository } from './infrastructure/prisma-preview-accounts.repository.js';
import { PREVIEW_ACCOUNTS_REPOSITORY } from './domain/ports/preview-accounts.repository.js';
import { AuthCapabilitiesController } from './presentation/auth-capabilities.controller.js';
import { EmailAuthController } from './presentation/email-auth.controller.js';
import { EmailAuthService } from './application/services/email-auth.service.js';
import { AuthMailService } from './application/services/auth-mail.service.js';
import { EMAIL_AUTH_REPOSITORY } from './domain/ports/email-auth.repository.js';
import { EMAIL_DELIVERY_REPOSITORY } from './domain/ports/email-delivery.repository.js';
import { EMAIL_SECURITY, EMAIL_QUOTA, MAIL_SENDER } from './domain/ports/email-security.port.js';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.port.js';
import { PrismaEmailAuthRepository } from './infrastructure/prisma-email-auth.repository.js';
import { PrismaEmailDeliveryRepository } from './infrastructure/prisma-email-delivery.repository.js';
import { EmailSecurityAdapter } from './infrastructure/email-security.js';
import { RedisEmailQuota } from './infrastructure/redis-email-quota.js';
import { SmtpMailSender } from './infrastructure/smtp-mail-sender.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';
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
import { BrowserAuthController } from './presentation/browser-auth.controller.js';
import { MeAuthController } from './presentation/me-auth.controller.js';

@Module({
  imports: [JwtModule.register({}), ProfilesModule],
  controllers: [
    AuthCapabilitiesController,
    AuthController,
    BrowserAuthController,
    MeAuthController,
    EmailAuthController,
  ],
  providers: [
    PreviewAccountsService,
    PrismaPreviewAccountsRepository,
    { provide: PREVIEW_ACCOUNTS_REPOSITORY, useExisting: PrismaPreviewAccountsRepository },
    EmailAuthService,
    AuthMailService,
    PrismaEmailAuthRepository,
    PrismaEmailDeliveryRepository,
    EmailSecurityAdapter,
    RedisEmailQuota,
    SmtpMailSender,
    ScryptPasswordHasher,
    { provide: EMAIL_AUTH_REPOSITORY, useExisting: PrismaEmailAuthRepository },
    { provide: EMAIL_DELIVERY_REPOSITORY, useExisting: PrismaEmailDeliveryRepository },
    { provide: EMAIL_SECURITY, useExisting: EmailSecurityAdapter },
    { provide: EMAIL_QUOTA, useExisting: RedisEmailQuota },
    { provide: MAIL_SENDER, useExisting: SmtpMailSender },
    { provide: PASSWORD_HASHER, useExisting: ScryptPasswordHasher },
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
  exports: [
    PreviewAccountsService,
    EmailAuthService,
    AuthMailService,
    SessionService,
    PhoneAuthService,
    PHONE_CHALLENGE_STORE,
  ],
})
export class AuthModule {}
