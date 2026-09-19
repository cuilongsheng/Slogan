import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Environment } from '../../src/config/environment.js';
import { SocialPresenceStore } from '../../src/infrastructure/redis/social-presence.service.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('social presence Redis runtime', () => {
  const logger = { warn: () => undefined } as unknown as StructuredLogger;

  it('refreshes, batches and expires a real Redis key without scanning', async () => {
    const environment = testEnvironment({
      REDIS_URL: 'redis://127.0.0.1:56379/13',
      SOCIAL_PRESENCE_TTL_SECONDS: 30,
    });
    const store = new SocialPresenceStore(
      new ConfigService<Environment, true>(environment),
      logger,
    );
    const redis = new Redis(environment.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    const userId = randomUUID();
    try {
      await redis.connect();
      await redis.del(`social:presence:${userId}`);
      const refreshed = await store.refresh(userId);
      expect(refreshed.refreshAfterSeconds).toBe(15);
      expect(refreshed.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(await store.online([userId, randomUUID()])).toEqual(new Set([userId]));
      expect(await redis.ttl(`social:presence:${userId}`)).toBeGreaterThan(0);
      await redis.expire(`social:presence:${userId}`, 1);
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect(await store.online([userId])).toEqual(new Set());
    } finally {
      await store.onModuleDestroy();
      redis.disconnect();
    }
  });

  it('fails closed when Redis is unavailable', async () => {
    const environment = testEnvironment({ REDIS_URL: 'redis://127.0.0.1:1' });
    const store = new SocialPresenceStore(
      new ConfigService<Environment, true>(environment),
      logger,
    );
    try {
      await expect(store.online([randomUUID()])).resolves.toEqual(new Set());
      await expect(store.refresh(randomUUID())).rejects.toMatchObject({
        code: 'SOCIAL_PRESENCE_UNAVAILABLE',
      });
    } finally {
      await store.onModuleDestroy();
    }
  });
});
