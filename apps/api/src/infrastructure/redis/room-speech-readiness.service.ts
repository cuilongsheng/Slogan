import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../../config/environment.js';

@Injectable()
export class RoomSpeechReadinessStore implements OnModuleDestroy {
  private readonly client: Redis | undefined;
  private readonly instanceId = randomUUID();
  private readonly key = 'room-speech:worker-ready';

  constructor(config: ConfigService<Environment, true>) {
    const url = config.get('REDIS_URL', { infer: true });
    if (url)
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
      });
  }

  async markReady(ttlSeconds = 15): Promise<void> {
    await this.call((client) => client.set(this.key, this.instanceId, 'EX', ttlSeconds));
  }

  async isReady(): Promise<boolean> {
    try {
      return (await this.call((client) => client.exists(this.key))) === 1;
    } catch {
      return false;
    }
  }

  async clearReady(): Promise<void> {
    try {
      await this.call((client) =>
        client.eval(
          'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end',
          1,
          this.key,
          this.instanceId,
        ),
      );
    } catch {
      // A shutdown path must remain bounded when Redis is unavailable.
    }
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  private async call<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
    if (!this.client) throw new Error('ROOM_SPEECH_READINESS_UNAVAILABLE');
    if (['wait', 'end'].includes(this.client.status)) await this.client.connect();
    return operation(this.client);
  }
}
