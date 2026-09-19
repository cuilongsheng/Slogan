import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../../../config/environment.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import type { AnonymousKeywordCandidate } from '../domain/entities/post-room-learning.js';
import type { KeywordCandidateStore } from '../domain/ports/keyword-candidate-store.port.js';

@Injectable()
export class RedisKeywordCandidateStore implements KeywordCandidateStore, OnModuleDestroy {
  private readonly client: Redis | undefined;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {
    const url = config.get('REDIS_URL', { infer: true });
    if (url) {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2_000,
        enableOfflineQueue: false,
      });
      this.client.on('error', () => this.logger.warn('post_room_keywords_redis_unavailable'));
    }
  }

  async append(input: Parameters<KeywordCandidateStore['append']>[0]): Promise<void> {
    if (!input.candidates.length) return;
    const args = input.candidates.flatMap((candidate) => [
      this.field(candidate.kind, candidate.normalizedText),
      String(candidate.count),
      candidate.displayText,
      candidate.extractorVersion,
    ]);
    const result = await this.call((client) =>
      client.eval(
        `if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end
         redis.call('hset',KEYS[2],'__owner',ARGV[1])
         local i=5
         while i<=#ARGV do
           redis.call('hincrby',KEYS[2],ARGV[i],ARGV[i+1])
           redis.call('hset',KEYS[3],ARGV[i],ARGV[i+2])
           redis.call('hset',KEYS[4],ARGV[i],ARGV[i+3])
           i=i+4
         end
         redis.call('expire',KEYS[2],ARGV[2])
         redis.call('expire',KEYS[3],ARGV[2])
         redis.call('expire',KEYS[4],ARGV[2])
         return 1`,
        4,
        this.leaseKey(input.roomId),
        this.countKey(input.roomId),
        this.displayKey(input.roomId),
        this.versionKey(input.roomId),
        input.fencingToken,
        input.ttlSeconds,
        input.maxKeywords,
        input.maxExpressions,
        ...args,
      ),
    );
    if (Number(result) !== 1) throw new Error('KEYWORD_CANDIDATE_FENCE_REJECTED');
    await this.trim(input.roomId, input.fencingToken, input.maxKeywords, input.maxExpressions);
  }

  async snapshot(roomId: string, fencingToken: string): Promise<AnonymousKeywordCandidate[]> {
    const values = (await this.call((client) =>
      client.eval(
        `if redis.call('get',KEYS[1]) ~= ARGV[1] then return false end
         redis.call('hset',KEYS[2],'__owner',ARGV[1])
         return {redis.call('hgetall',KEYS[2]),redis.call('hgetall',KEYS[3]),redis.call('hgetall',KEYS[4])}`,
        4,
        this.leaseKey(roomId),
        this.countKey(roomId),
        this.displayKey(roomId),
        this.versionKey(roomId),
        fencingToken,
      ),
    )) as [string[], string[], string[]] | null;
    if (!values) throw new Error('KEYWORD_CANDIDATE_FENCE_REJECTED');
    const record = (entries: string[]) =>
      Object.fromEntries(
        Array.from({ length: entries.length / 2 }, (_, index) => [
          entries[index * 2]!,
          entries[index * 2 + 1]!,
        ]),
      );
    const counts = record(values[0]);
    const displays = record(values[1]);
    const versions = record(values[2]);
    return Object.entries(counts)
      .filter(([field]) => field !== '__owner')
      .flatMap(([field, count]) => {
        const parsed = this.parseField(field);
        if (!parsed) return [];
        return [
          {
            ...parsed,
            displayText: displays[field] ?? parsed.normalizedText,
            extractorVersion: versions[field] ?? 'unknown',
            count: Math.max(1, Number(count) || 1),
          },
        ];
      });
  }

  async delete(roomId: string, fencingToken: string): Promise<void> {
    await this.call((client) =>
      client.eval(
        `if redis.call('get',KEYS[1]) ~= ARGV[1] then return 0 end
         if redis.call('hget',KEYS[2],'__owner') ~= ARGV[1] then return 0 end
         return redis.call('del',KEYS[2],KEYS[3],KEYS[4])`,
        4,
        this.leaseKey(roomId),
        this.countKey(roomId),
        this.displayKey(roomId),
        this.versionKey(roomId),
        fencingToken,
      ),
    );
  }

  async purgeOrphans(validRoomIds: Set<string>): Promise<number> {
    return this.call(async (client) => {
      let cursor = '0';
      let removed = 0;
      do {
        const [next, keys] = await client.scan(
          cursor,
          'MATCH',
          'post-room-keywords:*:counts',
          'COUNT',
          100,
        );
        cursor = next;
        for (const key of keys) {
          const roomId = key.slice('post-room-keywords:'.length, -':counts'.length);
          const ttl = await client.ttl(key);
          if (validRoomIds.has(roomId) && ttl > 0) continue;
          removed += await client.del(
            this.countKey(roomId),
            this.displayKey(roomId),
            this.versionKey(roomId),
          );
        }
      } while (cursor !== '0');
      return removed;
    });
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  private async trim(roomId: string, token: string, maxKeywords: number, maxExpressions: number) {
    const values = await this.call((client) => client.hgetall(this.countKey(roomId)));
    const remove: string[] = [];
    for (const kind of ['KEYWORD', 'EXPRESSION'] as const) {
      const limit = kind === 'KEYWORD' ? maxKeywords : maxExpressions;
      const rows = Object.entries(values)
        .filter(([field]) => field.startsWith(`${kind}:`))
        .sort(
          ([leftField, left], [rightField, right]) =>
            Number(right) - Number(left) || leftField.localeCompare(rightField),
        );
      remove.push(...rows.slice(limit).map(([field]) => field));
    }
    if (!remove.length) return;
    await this.call((client) =>
      client.eval(
        `if redis.call('hget',KEYS[1],'__owner') ~= ARGV[1] then return 0 end
         for i=2,#ARGV do
           redis.call('hdel',KEYS[1],ARGV[i]); redis.call('hdel',KEYS[2],ARGV[i]); redis.call('hdel',KEYS[3],ARGV[i])
         end
         return 1`,
        3,
        this.countKey(roomId),
        this.displayKey(roomId),
        this.versionKey(roomId),
        token,
        ...remove,
      ),
    );
  }

  private async call<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
    if (!this.client) throw new Error('POST_ROOM_KEYWORDS_REDIS_UNAVAILABLE');
    try {
      if (['wait', 'end'].includes(this.client.status)) await this.client.connect();
      return await operation(this.client);
    } catch (error) {
      this.client.disconnect();
      throw error;
    }
  }

  private field(kind: string, normalizedText: string): string {
    return `${kind}:${Buffer.from(normalizedText).toString('base64url')}`;
  }

  private parseField(
    field: string,
  ): Pick<AnonymousKeywordCandidate, 'kind' | 'normalizedText'> | null {
    const separator = field.indexOf(':');
    const kind = field.slice(0, separator);
    if (separator < 1 || (kind !== 'KEYWORD' && kind !== 'EXPRESSION')) return null;
    try {
      return {
        kind,
        normalizedText: Buffer.from(field.slice(separator + 1), 'base64url').toString('utf8'),
      };
    } catch {
      return null;
    }
  }

  private leaseKey(roomId: string) {
    return `room-speech:lease:${roomId}`;
  }
  private countKey(roomId: string) {
    return `post-room-keywords:${roomId}:counts`;
  }
  private displayKey(roomId: string) {
    return `post-room-keywords:${roomId}:display`;
  }
  private versionKey(roomId: string) {
    return `post-room-keywords:${roomId}:version`;
  }
}
