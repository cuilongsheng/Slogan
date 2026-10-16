import { ModerationModule } from './modules/moderation/index.js';
import { LiveUpdatesModule } from './modules/live-updates/index.js';
import { VoiceModule } from './modules/voice/voice.module.js';
import { MaintenanceModule } from './modules/maintenance/index.js';
import { DirectModule } from './modules/direct/index.js';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SentryModule } from '@sentry/nestjs/setup';

import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { ObservabilityModule } from './infrastructure/observability/observability.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AccountLifecycleModule } from './modules/account-lifecycle/index.js';
import { ProfilesModule } from './modules/profiles/index.js';
import { RoomsModule } from './modules/rooms/index.js';
import { BackofficeModule } from './modules/backoffice/index.js';
import { SafetyModule } from './modules/safety/index.js';
import { SocialModule } from './modules/social/index.js';
import { AssistanceModule } from './modules/assistance/index.js';
import { SpeechSafetyModule } from './modules/speech-safety/index.js';
import { PostRoomLearningModule } from './modules/post-room-learning/index.js';
import { OperationsModule } from './modules/operations/index.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['apps/api/.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ObservabilityModule,
    HealthModule,
    DatabaseModule,
    ProfilesModule,
    AuthModule,
    AccountLifecycleModule,
    RoomsModule,
    VoiceModule,
    ModerationModule,
    BackofficeModule,
    SafetyModule,
    SocialModule,
    DirectModule,
    MaintenanceModule,
    LiveUpdatesModule,
    AssistanceModule,
    SpeechSafetyModule,
    PostRoomLearningModule,
    OperationsModule,
  ],
})
export class AppModule {}
