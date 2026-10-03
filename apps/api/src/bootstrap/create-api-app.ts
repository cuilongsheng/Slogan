import { randomUUID } from 'node:crypto';

import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { raw, type Express } from 'express';
import { pinoHttp } from 'pino-http';

import { AppModule } from '../app.module.js';
import { ApiExceptionFilter } from '../common/filters/api-exception.filter.js';
import type { Environment } from '../config/environment.js';
import { StructuredLogger } from '../infrastructure/observability/structured-logger.service.js';
import { LOG_REDACTION } from '../infrastructure/observability/log-redaction.js';

export async function createApiApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureApiApp(app);
  return app;
}

export function configureApiApp(app: INestApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  const trustedProxies = config.get('EMAIL_AUTH_TRUSTED_PROXIES', { infer: true });
  if (config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true }) && trustedProxies) {
    (app.getHttpAdapter().getInstance() as Express).set(
      'trust proxy',
      trustedProxies.split(',').map((value) => value.trim()),
    );
  }
  app.useLogger(app.get(StructuredLogger));
  app.setGlobalPrefix('v1');
  app.use(helmet());
  app.use('/v1/webhooks/livekit', raw({ type: 'application/webhook+json', limit: '256kb' }));
  app.use(
    pinoHttp({
      level: config.get('NODE_ENV', { infer: true }) === 'test' ? 'silent' : 'info',
      genReqId(request, response) {
        const incoming = request.headers['x-request-id'];
        const requestId =
          typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      redact: LOG_REDACTION,
    }),
  );
  app.enableCors({
    origin: config.get('CORS_ALLOWED_ORIGINS', { infer: true }),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter(app.get(StructuredLogger)));
  app.enableShutdownHooks();
}
