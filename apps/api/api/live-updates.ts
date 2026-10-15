import type { IncomingMessage, ServerResponse } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { createApiApp } from '../src/bootstrap/create-api-app.js';
import { configureManagedRecovery } from '../src/bootstrap/managed-recovery.js';

// Give the stream a real configurable Vercel function while retaining the same Nest
// controller, guards, contract and cross-instance delivery as the public API.
let context: Promise<INestApplication> | undefined;
function application() {
  context ??= createApiApp()
    .then(async (app) => {
      configureManagedRecovery(app);
      await app.init();
      return app;
    })
    .catch((error) => {
      context = undefined;
      throw error;
    });
  return context;
}
export default async function stream(request: IncomingMessage, response: ServerResponse) {
  try {
    const app = await application();
    if (response.destroyed) return;
    request.url = '/v1/me/live-updates';
    await new Promise<void>((resolve) => {
      const finish = () => {
        response.removeListener('finish', finish);
        response.removeListener('close', finish);
        resolve();
      };
      response.once('finish', finish);
      response.once('close', finish);
      app.getHttpAdapter().getInstance()(request, response);
    });
  } catch {
    if (!response.headersSent && !response.destroyed)
      response
        .writeHead(503, {
          'content-type': 'application/json',
          'cache-control': 'private, no-store',
        })
        .end(
          JSON.stringify({
            code: 'LIVE_UPDATES_UNAVAILABLE',
            message: 'Live updates temporarily unavailable',
          }),
        );
  }
}
