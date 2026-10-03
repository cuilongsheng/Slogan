import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { AuthModule } from '../../modules/auth/auth.module.js';
import { AuthMailWorkerRunner } from './auth-mail-worker.runner.js';
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['apps/api/.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    ObservabilityModule,
    AuthModule,
  ],
  providers: [AuthMailWorkerRunner],
})
export class AuthMailWorkerModule {}
