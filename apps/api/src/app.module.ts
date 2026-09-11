import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/environment.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { ObservabilityModule } from './infrastructure/observability/observability.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProfilesModule } from './modules/profiles/index.js';
import { RoomsModule } from './modules/rooms/index.js';

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
    ProfilesModule,
    AuthModule,
    RoomsModule,
  ],
})
export class AppModule {}
