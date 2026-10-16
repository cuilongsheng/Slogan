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
import { LIVE_SCOPES } from '../domain/live-updates.port.js';
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
    const deadline = Date.now() + 5000;
    for (let batch = 0; batch < 10 && Date.now() < deadline; batch++) {
      const count = await this.prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<
            Array<{
              id: string;
              scope: LiveScope;
              ownerId: string | null;
              resourceId: string | null;
              kind: string | null;
            }>
          >`SELECT id,scope,"ownerId","resourceId",kind FROM "LiveUpdateOutbox" ORDER BY "createdAt",id LIMIT 100 FOR UPDATE SKIP LOCKED`;
          if (!rows.length) return 0;
          const pipeline = redis.pipeline();
          for (const row of rows) {
            pipeline.eval(
              publishLive,
              2,
              row.ownerId ? liveOwner(row.ownerId) : LIVE_PUBLIC,
              `slogan:live:sent:${row.id}`,
              row.scope,
              row.resourceId ?? '',
              row.kind ?? '',
            );
          }
          const published = await pipeline.exec();
          if (!published || published.some(([error]) => error))
            throw new Error('Live publication pending');
          await tx.liveUpdateOutbox.deleteMany({
            where: { id: { in: rows.map((row) => row.id) } },
          });
          return rows.length;
        },
        { timeout: 10000 },
      );
      if (count < 100) break;
    }
  }
  async reconcileRelease() {
    const redis = await this.redis();
    if (!(await redis.set('slogan:live:release-check', '1', 'EX', 300, 'NX'))) return;
    const response = await fetch('https://slogan-preview-mobile.pages.dev/downloads/android.json', {
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    if (!response.ok) throw new Error('Release metadata unavailable');
    const value: unknown = await response.json();
    if (!validRelease(value)) throw new Error('Invalid published release metadata');
    const prior = Number((await redis.get('slogan:live:release-version')) ?? 0);
    if (value.versionCode <= prior) return;
    // Commit the durable notification before recording progress; retries can duplicate, never lose it.
    await this.prisma.liveUpdateOutbox.create({ data: { scope: 'release' } });
    await redis.set('slogan:live:release-version', String(value.versionCode));
  }
  async canReceive(owner: string, change: StreamChange) {
    const { scope, resourceId, kind } = change;
    if (scope === 'rooms' || scope === 'partners' || scope === 'release') return !resourceId;
    if (['account', 'safety', 'reports', 'learning'].includes(scope)) return !resourceId;
    if (!resourceId) return scope === 'messages';
    if (['conversation-history', 'conversation-state', 'inbox', 'unread'].includes(scope))
      return !!(await this.prisma.directConversationMember.count({
        where: { userId: owner, conversationId: resourceId },
      }));
    if (scope === 'calls')
      return !!(await this.prisma.directCall.count({
        where: { id: resourceId, OR: [{ callerUserId: owner }, { calleeUserId: owner }] },
      }));
    const membership = await this.prisma.roomMembership.findUnique({
      where: { roomId_userId: { roomId: resourceId, userId: owner } },
      include: { room: true },
    });
    if (scope === 'invitations')
      return (
        (membership?.lifecycle === 'ACTIVE' &&
          membership.role === 'HOST' &&
          membership.room.hostUserId === owner) ||
        !!(await this.prisma.roomInvitation.count({
          where: { roomId: resourceId, inviteeUserId: owner },
        }))
      );
    if (scope === 'room-state' && kind === 'membership') return !!membership;
    if (membership?.lifecycle !== 'ACTIVE') return false;
    if (scope === 'room-safety')
      return (
        membership.role === 'HOST' &&
        membership.room.hostUserId === owner &&
        membership.room.sensitiveSpeechDetectionEnabled
      );
    if (scope === 'room-text') return ['OPEN', 'ENDING'].includes(membership.room.status);
    return scope === 'room-state';
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
                  const field = (name: string) => {
                    const index = fields.indexOf(name);
                    return index < 0 ? undefined : fields[index + 1];
                  };
                  const scope = field('scope') as LiveScope;
                  const resourceId = field('resourceId');
                  const kind = field('kind');
                  const publicScope = ['rooms', 'partners', 'release'].includes(scope);
                  return compare(id, pending.positions[index]!) > 0 &&
                    LIVE_SCOPES.includes(scope) &&
                    ((index === 0 && publicScope && !resourceId) || (index === 1 && !publicScope))
                    ? [
                        {
                          index,
                          id,
                          scope,
                          ...(resourceId ? { resourceId } : {}),
                          ...(kind === 'membership' || kind === 'visibility' ? { kind } : {}),
                        },
                      ]
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

export function validRelease(value: unknown): value is { versionCode: number } {
  if (typeof value !== 'object' || !value) return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(v.versionCode) &&
    Number(v.versionCode) > 0 &&
    Number(v.versionCode) < 2147483647 &&
    typeof v.version === 'string' &&
    /^\d+\.\d+\.\d+$/.test(v.version) &&
    typeof v.commit === 'string' &&
    /^[a-f0-9]{40}$/.test(v.commit) &&
    typeof v.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(v.sha256) &&
    Number.isSafeInteger(v.bytes) &&
    Number(v.bytes) > 0 &&
    v.package === 'com.slogan.mobile' &&
    v.apiOrigin === 'https://slogan-api-pi.vercel.app' &&
    v.signing === 'controlled-debug' &&
    v.certificateSha256 === 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c'
  );
}
