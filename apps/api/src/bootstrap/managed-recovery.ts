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
    response.once('finish', () => {
      const room = /^\/v1\/rooms\/([0-9a-f-]{36})\/(?:leave|end)$/.exec(request.path);
      if (request.method !== 'POST' || response.statusCode !== 200 || !room) return;
      // Wake durable commands promptly after commit and HTTP completion, without provider I/O here.
      waitUntil(
        (async () => {
          for (const id of await rooms.pendingCommands(room[1]!))
            await queue.enqueue({ kind: 'command', id });
        })().catch(() => logger.warn({ event: 'realtime_exit_cleanup_scheduling_pending' })),
      );
    });
    // Publishing a seed runs inside the request's OIDC context. Vercel tracks it
    // after the HTTP response; durable cleanup is still executed by the private consumer.
    waitUntil(
      Promise.all([
        (async () => queue.seedRecoveryFromRequest())(),
        (async () => maintenance.seed())(),
      ]).catch((error: unknown) => {
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
