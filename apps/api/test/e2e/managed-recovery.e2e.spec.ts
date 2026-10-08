import type { INestApplication } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import express from 'express';
import request from 'supertest';
import { configureManagedRecovery } from '../../src/bootstrap/managed-recovery.js';
import { RealtimeQueue } from '../../src/infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
const jest = import.meta.jest;

describe('Vercel request recovery seed', () => {
  const contextKey = Symbol.for('@vercel/request-context');
  const registry = globalThis as unknown as Record<symbol, unknown>;
  const original = registry[contextKey];
  afterAll(() => {
    if (original === undefined) delete registry[contextKey];
    else registry[contextKey] = original;
  });

  it('preserves request context and returns HTTP before a tracked queue send settles', async () => {
    const pending: Promise<unknown>[] = [];
    const context = new AsyncLocalStorage<{
      waitUntil: (promise: Promise<unknown>) => void;
      marker: string;
    }>();
    registry[contextKey] = { get: () => context.getStore() };
    let finish!: () => void;
    const send = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let marker: string | undefined;
    const server = express();
    server.use((_req, _res, next) =>
      context.run(
        { marker: 'fixture-request', waitUntil: (promise) => pending.push(promise) },
        next,
      ),
    );
    const queue = {
      managed: true,
      seedRecoveryFromRequest: () => {
        marker = context.getStore()?.marker;
        return send;
      },
    };
    const logger = { warn: jest.fn() };
    configureManagedRecovery({
      get: (token: unknown) => (token === RealtimeQueue ? queue : logger),
      use: (handler: express.RequestHandler) => server.use(handler),
    } as unknown as INestApplication);
    server.get('/probe', (_req, res) => res.json({ ok: true }));
    try {
      await request(server).get('/probe').expect(200, { ok: true });
      expect(marker).toBe('fixture-request');
      expect(pending).toHaveLength(1);
      expect(logger.warn).not.toHaveBeenCalled();
    } finally {
      finish();
      await Promise.all(pending);
    }
  });

  it.each([
    ['ForbiddenError', 'private-token-must-not-appear', 'ForbiddenError'],
    ['Error', 'Failed to get OIDC token. Cause: private-token-must-not-appear', 'OIDC_UNAVAILABLE'],
    ['private-token-name', 'private-token-must-not-appear', 'UNKNOWN'],
  ])('keeps HTTP success and logs only a safe category (%s)', async (name, message, category) => {
    const pending: Promise<unknown>[] = [];
    registry[contextKey] = {
      get: () => ({ waitUntil: (promise: Promise<unknown>) => pending.push(promise) }),
    };
    const error = new Error(message);
    error.name = name;
    const queue = {
      managed: true,
      seedRecoveryFromRequest: async () => {
        throw error;
      },
    };
    const logger = { warn: jest.fn() };
    const server = express();
    configureManagedRecovery({
      get: (token: unknown) =>
        token === RealtimeQueue ? queue : token === StructuredLogger ? logger : undefined,
      use: (handler: express.RequestHandler) => server.use(handler),
    } as unknown as INestApplication);
    server.get('/probe', (_req, res) => res.sendStatus(200));
    await request(server).get('/probe').expect(200);
    await Promise.all(pending);
    expect(logger.warn).toHaveBeenCalledWith({
      event: 'realtime_managed_recovery_seed_pending',
      category,
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private-token');
  });
});
