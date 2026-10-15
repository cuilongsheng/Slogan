import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { QueueClient } from '@vercel/queue';
import {
  LIVE_PUBLIC,
  LIVE_EXPIRIES,
  renewLivePresence,
  expireLivePresence,
} from './live-stream.scripts.js';

import type { Environment } from '../../config/environment.js';
import { SocialError } from '../../modules/social/domain/errors/social.error.js';
import type { SocialPresence } from '../../modules/social/domain/ports/presence.port.js';
import { StructuredLogger } from '../observability/structured-logger.service.js';

@Injectable()
export class SocialPresenceStore implements SocialPresence, OnModuleDestroy {
  private readonly client: Redis | undefined;
  private readonly ttlSeconds: number;
  private connecting: Promise<void> | null = null;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {
    this.ttlSeconds = config.get('SOCIAL_PRESENCE_TTL_SECONDS', { infer: true });
    const url = config.get('REDIS_URL', { infer: true });
    if (url) {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
      });
      this.client.on('error', () => this.logger.warn('social_presence_redis_unavailable'));
    }
  }

  async refresh(userId: string): Promise<{ expiresAt: Date; refreshAfterSeconds: number }> {
    if (!this.client)
      throw new SocialError('SOCIAL_PRESENCE_UNAVAILABLE', 'Presence is temporarily unavailable');
    try {
      await this.connect();
      await this.client.eval(
        renewLivePresence,
        3,
        this.key(userId),
        LIVE_PUBLIC,
        LIVE_EXPIRIES,
        userId,
        this.ttlSeconds,
      );
      if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') {
        const chain = `slogan:live:presence-chain:${userId}`;
        const generation = randomUUID();
        if (
          await this.client.set(chain, generation, 'EX', Math.max(300, this.ttlSeconds * 3), 'NX')
        ) {
          try {
            await new QueueClient().send(
              'slogan-maintenance',
              { kind: 'presence-expiry', userId, generation },
              { delaySeconds: this.ttlSeconds, retentionSeconds: 604800 },
            );
          } catch (error) {
            await this.client.del(chain);
            throw error;
          }
        }
      }
      return {
        expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
        refreshAfterSeconds: Math.max(15, Math.floor(this.ttlSeconds / 2)),
      };
    } catch {
      this.client.disconnect();
      throw new SocialError('SOCIAL_PRESENCE_UNAVAILABLE', 'Presence is temporarily unavailable');
    }
  }

  async online(userIds: string[]): Promise<Set<string>> {
    if (!userIds.length) return new Set();
    if (!this.client)
      throw new SocialError('SOCIAL_PRESENCE_UNAVAILABLE', 'Presence is temporarily unavailable');
    try {
      await this.connect();
      const values = await this.client.mget(userIds.map((userId) => this.key(userId)));
      return new Set(userIds.filter((_userId, index) => values[index] !== null));
    } catch {
      this.client.disconnect();
      throw new SocialError('SOCIAL_PRESENCE_UNAVAILABLE', 'Presence is temporarily unavailable');
    }
  }

  async clear(userId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.connect();
      await this.client.del(this.key(userId));
      await this.client.eval(
        expireLivePresence,
        3,
        this.key(userId),
        LIVE_PUBLIC,
        LIVE_EXPIRIES,
        userId,
      );
    } catch {
      this.client.disconnect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.disconnect();
  }

  private async connect(): Promise<void> {
    if (!this.client || this.client.status === 'ready') return;
    if (this.connecting) return this.connecting;
    const operation = this.client.connect().finally(() => {
      if (this.connecting === operation) this.connecting = null;
    });
    this.connecting = operation;
    return operation;
  }

  private key(userId: string): string {
    return `social:presence:${userId}`;
  }
}
