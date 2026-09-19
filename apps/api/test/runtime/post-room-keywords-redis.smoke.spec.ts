import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../src/config/environment.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { RedisKeywordCandidateStore } from '../../src/modules/post-room-learning/infrastructure/redis-keyword-candidate.store.js';
import { RedisRoomSpeechCoordinator } from '../../src/modules/speech-safety/infrastructure/redis-room-speech-coordinator.js';
import { realtimeEnvironment } from '../fixtures/realtime.js';

describe('post-room keyword Redis fencing smoke', () => {
  it('preserves anonymous counts across a new lease and rejects every stale-token operation', async () => {
    const config = new ConfigService<Environment, true>(realtimeEnvironment());
    const logger = { warn: () => undefined } as unknown as StructuredLogger;
    const coordinator = new RedisRoomSpeechCoordinator(config, logger);
    const store = new RedisKeywordCandidateStore(config, logger);
    const roomId = randomUUID();
    const first = await coordinator.acquireRoom(roomId);
    expect(first).not.toBeNull();
    await store.append({
      roomId,
      fencingToken: first!.fencingToken,
      candidates: [
        {
          kind: 'KEYWORD',
          normalizedText: 'travel',
          displayText: 'travel',
          count: 1,
          extractorVersion: 'v1',
        },
      ],
      ttlSeconds: 300,
      maxKeywords: 5,
      maxExpressions: 5,
    });
    await coordinator.releaseRoom(roomId, first!.fencingToken);
    const second = await coordinator.acquireRoom(roomId);
    expect(second).not.toBeNull();
    await store.append({
      roomId,
      fencingToken: second!.fencingToken,
      candidates: [
        {
          kind: 'EXPRESSION',
          normalizedText: 'travel plans',
          displayText: 'travel plans',
          count: 2,
          extractorVersion: 'v1',
        },
      ],
      ttlSeconds: 300,
      maxKeywords: 5,
      maxExpressions: 5,
    });

    await expect(
      store.append({
        roomId,
        fencingToken: first!.fencingToken,
        candidates: [
          {
            kind: 'KEYWORD',
            normalizedText: 'stale',
            displayText: 'stale',
            count: 1,
            extractorVersion: 'v1',
          },
        ],
        ttlSeconds: 300,
        maxKeywords: 5,
        maxExpressions: 5,
      }),
    ).rejects.toThrow('FENCE_REJECTED');
    await expect(store.snapshot(roomId, first!.fencingToken)).rejects.toThrow('FENCE_REJECTED');
    await store.delete(roomId, first!.fencingToken);
    expect(
      (await store.snapshot(roomId, second!.fencingToken))
        .map(({ normalizedText }) => normalizedText)
        .sort(),
    ).toEqual(['travel', 'travel plans']);
    await store.delete(roomId, second!.fencingToken);
    expect(await store.snapshot(roomId, second!.fencingToken)).toEqual([]);

    await coordinator.releaseRoom(roomId, second!.fencingToken);
    coordinator.onModuleDestroy();
    store.onModuleDestroy();
  });
});
