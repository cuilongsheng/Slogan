import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { OperationsModule } from '../../modules/operations/index.js';
import { OperationsWorkerRunner } from './operations-worker.runner.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: ['apps/api/.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ObservabilityModule,
    DatabaseModule,
    OperationsModule,
  ],
  providers: [OperationsWorkerRunner],
})
export class OperationsWorkerModule {}
