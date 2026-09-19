import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { PostRoomLearningService } from '../../src/modules/post-room-learning/index.js';
import type { KeywordCandidatePolicy } from '../../src/modules/post-room-learning/index.js';
import type { KeywordCandidateStore } from '../../src/modules/post-room-learning/domain/ports/keyword-candidate-store.port.js';
import type { PostRoomLearningRepository } from '../../src/modules/post-room-learning/domain/ports/post-room-learning.repository.js';
import type {
  RoomSpeechCoordinator,
  RoomSpeechSafetyService,
} from '../../src/modules/speech-safety/index.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('PostRoomLearningService candidate degradation', () => {
  const roomId = '00000000-0000-4000-8000-000000000001';
  const transcript = 'private complete transcript that must never enter an incident';

  function setup(input: { extract: ReturnType<typeof fn>; append: ReturnType<typeof fn> }) {
    const degrade = fn(async () => undefined);
    const recoverIncident = fn(async () => undefined);
    const safety = {
      degrade,
      recoverIncident,
    } as unknown as RoomSpeechSafetyService;
    const service = new PostRoomLearningService(
      {} as PostRoomLearningRepository,
      { append: input.append } as unknown as KeywordCandidateStore,
      {} as RoomSpeechCoordinator,
      safety,
      { extract: input.extract } as unknown as KeywordCandidatePolicy,
      new ConfigService<Environment, true>(testEnvironment()),
      {} as StructuredLogger,
    );
    return { service, degrade, recoverIncident };
  }

  it('records a content-free extraction incident and backs off later windows', async () => {
    const extract = fn(() => {
      throw new Error('extractor unavailable');
    });
    const append = fn(async () => undefined);
    const { service, degrade } = setup({ extract, append });

    await expect(
      service.consumeTranscript({ roomId, transcript, fencingToken: 'fence-1' }),
    ).resolves.toEqual({
      candidateCount: 0,
    });
    await expect(
      service.consumeTranscript({ roomId, transcript, fencingToken: 'fence-1' }),
    ).resolves.toEqual({
      candidateCount: 0,
    });

    expect(extract).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
    expect(degrade).toHaveBeenCalledWith(
      roomId,
      'KEYWORD_CANDIDATE_EXTRACTION',
      'CANDIDATE_EXTRACTION_FAILED',
    );
    expect(JSON.stringify(degrade.mock.calls)).not.toContain(transcript);
  });

  it('isolates a candidate-store failure and records only normalized metadata', async () => {
    const candidates = [
      {
        kind: 'KEYWORD' as const,
        displayText: 'practice',
        normalizedText: 'practice',
        count: 1,
        extractorVersion: '2026-09-v1',
      },
    ];
    const extract = fn(() => candidates);
    const append = fn(async () => {
      throw new Error('redis unavailable');
    });
    const { service, degrade, recoverIncident } = setup({ extract, append });

    await expect(
      service.consumeTranscript({ roomId, transcript, fencingToken: 'fence-1' }),
    ).rejects.toThrow('redis unavailable');

    expect(degrade).toHaveBeenCalledWith(
      roomId,
      'KEYWORD_CANDIDATE_STORE',
      'CANDIDATE_STORE_UNAVAILABLE',
    );
    expect(recoverIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId,
        component: 'KEYWORD_CANDIDATE_EXTRACTION',
        errorCategory: 'CANDIDATE_EXTRACTION_FAILED',
      }),
    );
    expect(JSON.stringify(degrade.mock.calls)).not.toContain(transcript);
  });

  it('recovers both purpose incidents after candidate extraction and storage succeed', async () => {
    const extract = fn(() => [
      {
        kind: 'KEYWORD' as const,
        displayText: 'practice',
        normalizedText: 'practice',
        count: 1,
        extractorVersion: '2026-09-v1',
      },
    ]);
    const append = fn(async () => undefined);
    const { service, recoverIncident } = setup({ extract, append });

    await expect(
      service.consumeTranscript({ roomId, transcript, fencingToken: 'fence-1' }),
    ).resolves.toEqual({ candidateCount: 1 });

    expect(recoverIncident).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'KEYWORD_CANDIDATE_EXTRACTION' }),
    );
    expect(recoverIncident).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'KEYWORD_CANDIDATE_STORE' }),
    );
  });
});
