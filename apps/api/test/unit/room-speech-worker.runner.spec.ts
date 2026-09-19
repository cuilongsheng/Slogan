import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import type { RoomSpeechReadinessStore } from '../../src/infrastructure/redis/room-speech-readiness.service.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import type {
  RoomMediaSource,
  RoomSpeechCoordinator,
} from '../../src/modules/speech-safety/index.js';
import type { RoomSpeechProcessingService } from '../../src/modules/room-speech-processing/index.js';
import { RoomSpeechWorkerRunner } from '../../src/workers/room-speech/room-speech-worker.runner.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('RoomSpeechWorkerRunner readiness', () => {
  it.each(['REDIS', 'POSTGRESQL', 'LIVEKIT', 'STT'] as const)(
    'does not acquire a room lease when %s readiness fails',
    async (failed) => {
      const acquireRoom = fn(async () => ({ fencingToken: 'unexpected' }));
      const coordinator = {
        healthCheck: fn(async () => {
          if (failed === 'REDIS') throw new Error('unavailable');
        }),
        acquireRoom,
      } as unknown as RoomSpeechCoordinator;
      const media = {
        healthCheck: fn(async () => {
          if (failed === 'LIVEKIT') throw new Error('unavailable');
        }),
      } as unknown as RoomMediaSource;
      const service = {
        healthCheck: fn(async () => {
          if (failed === 'STT') throw new Error('unavailable');
        }),
        activeRooms: fn(async () => {
          if (failed === 'POSTGRESQL') throw new Error('unavailable');
          return [{ id: 'room', endsAt: new Date(Date.now() + 60_000) }];
        }),
      } as unknown as RoomSpeechProcessingService;
      const readiness = {
        markReady: fn(async () => undefined),
        clearReady: fn(async () => undefined),
      } as unknown as RoomSpeechReadinessStore;
      const runner = new RoomSpeechWorkerRunner(
        new ConfigService<Environment, true>(
          testEnvironment({ ROOM_SPEECH_DETECTION_ENABLED: true }),
        ),
        service,
        coordinator,
        media,
        { warn: fn() } as unknown as StructuredLogger,
        readiness,
      );

      await expect(runner.reconcile()).rejects.toThrow('unavailable');
      expect(acquireRoom).not.toHaveBeenCalled();
      expect(readiness.markReady).not.toHaveBeenCalled();
      expect(readiness.clearReady).toHaveBeenCalled();
      expect(runner.health()).toMatchObject({ live: true, ready: false, activeRooms: 0 });
    },
  );
});
