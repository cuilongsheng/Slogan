import type { INestApplication } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import type { RequestHandler } from 'express';
import { RealtimeQueue } from '../infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../infrastructure/observability/structured-logger.service.js';

export function configureManagedRecovery(app: INestApplication): void {
  const queue = app.get(RealtimeQueue);
  if (!queue.managed) return;
  const logger = app.get(StructuredLogger);
  app.use(((_request, _response, next) => {
    // Publishing a seed runs inside the request's OIDC context. Vercel tracks it
    // after the HTTP response; durable cleanup is still executed by the private consumer.
    waitUntil(
      queue.seedRecoveryFromRequest().catch((error: unknown) => {
        const knownNames = [
          'UnauthorizedError',
          'ForbiddenError',
          'BadRequestError',
          'TooManyRequestsError',
          'InternalServerError',
        ];
        const category =
          error instanceof Error && error.message.includes('Failed to get OIDC token')
            ? 'OIDC_UNAVAILABLE'
            : error instanceof Error && knownNames.includes(error.name)
              ? error.name
              : 'UNKNOWN';
        logger.warn({ event: 'realtime_managed_recovery_seed_pending', category });
      }),
    );
    next();
  }) as RequestHandler);
}
