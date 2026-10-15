import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../../../config/environment.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  LIVE_PUBLIC,
  LIVE_EXPIRIES,
  liveOwner,
  publishLive,
  expireLivePresence,
} from '../../../infrastructure/redis/live-stream.scripts.js';
import type {
  LiveUpdatesStore,
  LiveScope,
  StreamChange,
  StreamPositions,
} from '../domain/live-updates.port.js';

@Injectable()
export class RedisLiveUpdatesStore implements LiveUpdatesStore, OnModuleDestroy {
  private client?: Redis;
  private blocking: Redis | undefined;
  private reading = false;
  private readonly subscribers = new Set<Subscriber>();
  private connecting: Promise<void> | undefined;
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly prisma: PrismaService,
  ) {}
  private async redis() {
    const url = this.config.get('REDIS_URL', { infer: true });
    if (!url) throw new Error('Live updates unavailable');
    if (!this.client) {
      this.client = new Redis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      this.client.on('error', ignore);
    }
    if (this.client.status !== 'ready') {
      this.connecting ??= this.client.connect().finally(() => {
        this.connecting = undefined;
      });
      await this.connecting;
    }
    return this.client;
  }
  async dispatch() {
    const redis = await this.redis();
    const time = await redis.time();
    const due = await redis.zrangebyscore(
      LIVE_EXPIRIES,
      '-inf',
      Number(time[0]) * 1000 + Math.floor(Number(time[1]) / 1000),
      'LIMIT',
      0,
      100,
    );
    for (const owner of due) await this.expirePresence(owner);
    await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; scope: LiveScope; ownerId: string | null }>
        >`SELECT id,scope,"ownerId" FROM "LiveUpdateOutbox" ORDER BY "createdAt",id LIMIT 100 FOR UPDATE SKIP LOCKED`;
        for (const row of rows) {
          await redis.eval(
            publishLive,
            2,
            row.ownerId ? liveOwner(row.ownerId) : LIVE_PUBLIC,
            `slogan:live:sent:${row.id}`,
            row.scope,
          );
          await tx.$executeRaw`DELETE FROM "LiveUpdateOutbox" WHERE id=${row.id}::uuid`;
        }
      },
      { timeout: 10000 },
    );
  }
  async expirePresence(owner: string, generation?: string) {
    const redis = await this.redis();
    return Number(
      await redis.eval(
        expireLivePresence,
        generation ? 4 : 3,
        `social:presence:${owner}`,
        LIVE_PUBLIC,
        LIVE_EXPIRIES,
        ...(generation ? [`slogan:live:presence-chain:${owner}`] : []),
        owner,
        ...(generation ? [generation] : []),
      ),
    );
  }
  async bounds(owner: string) {
    const redis = await this.redis();
    const keys = [LIVE_PUBLIC, liveOwner(owner)];
    const first = (await Promise.all(
      keys.map(async (k) => (await redis.xrange(k, '-', '+', 'COUNT', 1))[0]?.[0] ?? '0-0'),
    )) as StreamPositions;
    const last = (await Promise.all(
      keys.map(async (k) => (await redis.xrevrange(k, '+', '-', 'COUNT', 1))[0]?.[0] ?? '0-0'),
    )) as StreamPositions;
    return { first, last };
  }
  async reader(owner: string, signal: AbortSignal) {
    await this.redis();
    if (signal.aborted || this.subscribers.size >= 128)
      throw new Error('Stream capacity unavailable');
    const subscriber: Subscriber = { owner, pending: undefined };
    this.subscribers.add(subscriber);
    const close = () => {
      signal.removeEventListener('abort', close);
      this.subscribers.delete(subscriber);
      subscriber.pending?.reject(new Error('Stream cancelled'));
      subscriber.pending = undefined;
      if (!this.subscribers.size) {
        this.blocking?.disconnect();
        this.blocking = undefined;
      }
    };
    signal.addEventListener('abort', close, { once: true });
    return {
      read: (positions: StreamPositions) =>
        new Promise<StreamChange[]>((resolve, reject) => {
          if (signal.aborted || !this.subscribers.has(subscriber) || subscriber.pending) {
            reject(new Error('Stream cancelled'));
            return;
          }
          subscriber.pending = { positions: [...positions], resolve, reject };
          void this.pump();
        }),
      close,
    };
  }
  /** One bounded blocking reader per API instance; private keys fan out only to their owner. */
  private async pump() {
    if (this.reading) return;
    this.reading = true;
    try {
      for (;;) {
        const requests = [...this.subscribers].flatMap((s) =>
          s.pending ? [{ subscriber: s, pending: s.pending }] : [],
        );
        if (!requests.length) break;
        try {
          if (!this.blocking) {
            this.blocking = (await this.redis()).duplicate({ lazyConnect: true });
            this.blocking.on('error', ignore);
            await this.blocking.connect();
          }
          if (!this.subscribers.size) {
            this.blocking?.disconnect();
            this.blocking = undefined;
            break;
          }
          const positions = new Map<string, string>();
          for (const { subscriber, pending } of requests) {
            for (const [i, key] of [LIVE_PUBLIC, liveOwner(subscriber.owner)].entries()) {
              const next = pending.positions[i]!;
              const prior = positions.get(key);
              if (!prior || compare(next, prior) < 0) positions.set(key, next);
            }
          }
          const keys = [...positions.keys()];
          const result = (await this.blocking.xread(
            'COUNT',
            100,
            'BLOCK',
            1000,
            'STREAMS',
            ...keys,
            ...positions.values(),
          )) as Array<[string, Array<[string, string[]]>]> | null;
          for (const { subscriber, pending } of requests) {
            if (subscriber.pending !== pending) continue;
            subscriber.pending = undefined;
            const ownKeys = [LIVE_PUBLIC, liveOwner(subscriber.owner)];
            pending.resolve(
              (result ?? []).flatMap(([key, entries]) => {
                const index = ownKeys.indexOf(key);
                if (index < 0) return [];
                return entries.flatMap(([id, fields]) => {
                  const scope = fields[fields.indexOf('scope') + 1];
                  return compare(id, pending.positions[index]!) > 0 &&
                    ((index === 0 && (scope === 'rooms' || scope === 'partners')) ||
                      (index === 1 && scope === 'messages'))
                    ? [{ index, id, scope: scope as LiveScope }]
                    : [];
                });
              }),
            );
          }
        } catch (error) {
          this.blocking?.disconnect();
          this.blocking = undefined;
          for (const { subscriber, pending } of requests) {
            if (subscriber.pending !== pending) continue;
            subscriber.pending = undefined;
            pending.reject(error);
          }
        }
      }
    } finally {
      this.reading = false;
    }
  }
  onModuleDestroy() {
    this.blocking?.disconnect();
    for (const subscriber of this.subscribers)
      subscriber.pending?.reject(new Error('Stream closed'));
    this.subscribers.clear();
    this.client?.disconnect();
  }
}
const ignore = () => {};

interface Subscriber {
  owner: string;
  pending:
    | {
        positions: StreamPositions;
        resolve: (changes: StreamChange[]) => void;
        reject: (error: unknown) => void;
      }
    | undefined;
}
function compare(a: string, b: string) {
  const [at, as] = a.split('-').map(BigInt),
    [bt, bs] = b.split('-').map(BigInt);
  return at === bt ? (as! < bs! ? -1 : as === bs ? 0 : 1) : at! < bt! ? -1 : 1;
}
