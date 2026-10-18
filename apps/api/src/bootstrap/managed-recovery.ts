import type { INestApplication } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import type { RequestHandler } from 'express';
import { RoomRealtimeService } from '../modules/rooms/index.js';
import { MaintenanceService } from '../modules/maintenance/index.js';
import { RealtimeQueue } from '../infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../infrastructure/observability/structured-logger.service.js';

export function configureManagedRecovery(app: INestApplication): void {
  const queue = app.get(RealtimeQueue);
  if (!queue.managed) return;
  const maintenance = app.get(MaintenanceService);
  const logger = app.get(StructuredLogger);
  const rooms = app.get(RoomRealtimeService);
  app.use(((request, response, next) => {
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ||
      request.path === '/v1/me/presence/heartbeat'
    ) {
      next();
      return;
    }
    response.once('finish', () => {
      if (response.statusCode < 200 || response.statusCode >= 400) return;
      // All domain transactions have completed. Keep OIDC context without blocking HTTP.
      waitUntil(
        (async () => {
          await maintenance.seed(
            (request.path.startsWith('/v1/rooms') ||
              request.path.startsWith('/v1/appointment-rooms')) &&
              !request.path.endsWith('/realtime-credentials'),
          );
          const room = /^\/v1\/rooms\/([0-9a-f-]{36})\/(?:leave|end)$/.exec(request.path);
          if (response.statusCode !== 200 || !room) return;
          for (const id of await rooms.pendingCommands(room[1]!))
            await queue.enqueue({ kind: 'command', id });
        })().catch((error: unknown) => {
          const names = [
            'UnauthorizedError',
            'ForbiddenError',
            'BadRequestError',
            'TooManyRequestsError',
            'InternalServerError',
          ];
          const category =
            error instanceof Error && error.message.includes('Failed to get OIDC token')
              ? 'OIDC_UNAVAILABLE'
              : error instanceof Error && names.includes(error.name)
                ? error.name
                : 'UNKNOWN';
          logger.warn({ event: 'realtime_managed_recovery_seed_pending', category });
        }),
      );
    });
    next();
  }) as RequestHandler);
}
