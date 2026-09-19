import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Environment } from '../../config/environment.js';
import {
  AssistanceError,
  type AssistanceCoordinator,
  type AssistancePermit,
} from '../../modules/assistance/contracts.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';

@Injectable()
export class AssistanceCoordinatorStore implements AssistanceCoordinator, OnModuleDestroy {
  private readonly client: Redis | undefined;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {
    const url = config.get('REDIS_URL', { infer: true });
    if (url) {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
      });
      this.client.on('error', () => this.logger.warn('assistance_redis_unavailable'));
    }
  }

  async acquire(userId: string): Promise<AssistancePermit> {
    if (!this.client)
      throw new AssistanceError('ASSISTANCE_UNAVAILABLE', 'Assistance is temporarily unavailable');
    const windowSeconds = this.config.get('ASSISTANCE_RATE_LIMIT_DURATION_SECONDS', {
      infer: true,
    });
    const window = Math.floor(Date.now() / (windowSeconds * 1000));
    const rateKey = `assistance:rate:${userId}:${window}`;
    const concurrentKey = `assistance:concurrent:${userId}`;
    try {
      await this.connect();
      const result = (await this.client.eval(
        `local rate=redis.call('INCR',KEYS[1])
         if rate==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]) end
         local ttl=redis.call('TTL',KEYS[1])
         if rate>tonumber(ARGV[1]) then return {0,ttl} end
         local concurrent=redis.call('INCR',KEYS[2])
         if concurrent==1 then redis.call('EXPIRE',KEYS[2],ARGV[4]) end
         if concurrent>tonumber(ARGV[3]) then redis.call('DECR',KEYS[2]); return {-1,ttl} end
         return {1,ttl}`,
        2,
        rateKey,
        concurrentKey,
        this.config.get('ASSISTANCE_RATE_LIMIT_POINTS', { infer: true }),
        windowSeconds,
        this.config.get('ASSISTANCE_MAX_CONCURRENT', { infer: true }),
        this.config.get('ASSISTANCE_LEASE_SECONDS', { infer: true }) + 5,
      )) as [number, number];
      if (result[0] !== 1)
        throw new AssistanceError('ASSISTANCE_RATE_LIMITED', 'Assistance rate limit exceeded', {
          retryAfterSeconds: Math.max(1, result[1]),
        });
      let released = false;
      return {
        release: async () => {
          if (released) return;
          released = true;
          try {
            await this.client!.eval(
              `local value=tonumber(redis.call('GET',KEYS[1]) or '0')
               if value<=1 then redis.call('DEL',KEYS[1]) else redis.call('DECR',KEYS[1]) end
               return 1`,
              1,
              concurrentKey,
            );
          } catch {
            this.client?.disconnect();
          }
        },
      };
    } catch (error) {
      if (error instanceof AssistanceError) throw error;
      this.client.disconnect();
      throw new AssistanceError('ASSISTANCE_UNAVAILABLE', 'Assistance is temporarily unavailable');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.disconnect();
  }

  private async connect(): Promise<void> {
    if (this.client && ['wait', 'end'].includes(this.client.status)) await this.client.connect();
  }
}
