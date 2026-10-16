import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from '../../config/environment.js';
import { ObservabilityModule } from '../../infrastructure/observability/observability.module.js';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { OperationsModule } from '../../modules/operations/index.js';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['apps/api/.env', '.env'],
      validate: validateEnvironment,
    }),
    ObservabilityModule,
    DatabaseModule,
    OperationsModule,
  ],
})
export class MonitorWorkerModule {}
