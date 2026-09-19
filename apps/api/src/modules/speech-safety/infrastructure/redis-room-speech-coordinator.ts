import { randomUUID } from 'node:crypto';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../../../config/environment.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import { RoomSpeechSafetyError } from '../domain/errors/room-speech-safety.error.js';
import type { RoomSpeechCoordinator } from '../domain/ports/room-speech-coordinator.port.js';

@Injectable()
export class RedisRoomSpeechCoordinator implements RoomSpeechCoordinator, OnModuleDestroy {
  private readonly client: Redis | undefined;
  private readonly leaseSeconds: number;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {
    this.leaseSeconds = config.get('ROOM_SPEECH_LEASE_SECONDS', { infer: true });
    const url = config.get('REDIS_URL', { infer: true });
    if (url) {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
      });
      this.client.on('error', () => this.logger.warn('room_speech_redis_unavailable'));
    }
  }

  async healthCheck(): Promise<void> {
    const result = await this.call((client) => client.ping());
    if (result !== 'PONG') throw RoomSpeechSafetyError.unavailable();
  }

  async acquireRoom(roomId: string) {
    const token = randomUUID();
    const result = await this.call((client) =>
      client.set(this.leaseKey(roomId), token, 'EX', this.leaseSeconds, 'NX'),
    );
    return result === 'OK' ? { fencingToken: token } : null;
  }

  async renewRoom(roomId: string, fencingToken: string) {
    const result = await this.call((client) =>
      client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) else return 0 end',
        1,
        this.leaseKey(roomId),
        fencingToken,
        this.leaseSeconds,
      ),
    );
    return Number(result) === 1;
  }

  async releaseRoom(roomId: string, fencingToken: string) {
    await this.call((client) =>
      client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        this.leaseKey(roomId),
        fencingToken,
      ),
    );
  }

  async allowRisk(key: string, ttlSeconds: number, limit: number) {
    const result = await this.call((client) =>
      client.eval(
        'local n=redis.call("incr",KEYS[1]); if n==1 then redis.call("expire",KEYS[1],ARGV[1]) end; return n',
        1,
        'room-speech:risk:' + key,
        ttlSeconds,
      ),
    );
    return Number(result) <= limit;
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  private async call<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
    if (!this.client) throw RoomSpeechSafetyError.unavailable();
    try {
      if (['wait', 'end'].includes(this.client.status)) await this.client.connect();
      return await operation(this.client);
    } catch {
      this.client.disconnect();
      throw RoomSpeechSafetyError.unavailable();
    }
  }

  private leaseKey(roomId: string) {
    return 'room-speech:lease:' + roomId;
  }
}
