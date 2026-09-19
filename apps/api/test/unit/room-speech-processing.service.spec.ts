import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import type { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import type { PostRoomLearningService } from '../../src/modules/post-room-learning/index.js';
import { RoomSpeechProcessingService } from '../../src/modules/room-speech-processing/index.js';
import type { RoomSpeechProcessingRepository } from '../../src/modules/room-speech-processing/domain/room-speech-processing.repository.js';
import type {
  RoomSpeechCoordinator,
  RoomSpeechSafetyService,
  RoomSpeechTranscriber,
} from '../../src/modules/speech-safety/index.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('RoomSpeechProcessingService', () => {
  const context = {
    roomId: '00000000-0000-4000-8000-000000000001',
    participantIdentity: 'participant',
    roomEndsAt: new Date(Date.now() + 60_000),
    safety: {
      roomId: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      participantIdentity: 'participant',
      consentGeneration: 'safety-generation',
      roomEndsAt: new Date(Date.now() + 60_000),
    },
    postRoomKeywordsConsentGeneration: 'keywords-generation',
  };

  function fixture(contexts = [context, context]) {
    const participant = fn(async () => contexts.shift() ?? null);
    const repository = { participant } as unknown as RoomSpeechProcessingRepository;
    const coordinator = { renewRoom: fn(async () => true) } as unknown as RoomSpeechCoordinator;
    let providerAudio: Uint8Array | undefined;
    const close = fn(async () => undefined);
    const transcribeWindow = fn(async (input: { audio: Uint8Array }) => {
      providerAudio = input.audio;
      return { transcript: 'useful travel phrase', durationMs: 500, usageUnits: 1 };
    });
    const transcriber = {
      category: 'TEST_STT',
      healthCheck: fn(async () => undefined),
      openSession: fn(async () => ({ transcribeWindow, close })),
    } as unknown as RoomSpeechTranscriber;
    const consumeSafety = fn(async () => undefined);
    const safety = {
      consumeTranscript: consumeSafety,
      degrade: fn(async () => undefined),
    } as unknown as RoomSpeechSafetyService;
    const consumeLearning = fn(async () => undefined);
    const learning = {
      consumeTranscript: consumeLearning,
    } as unknown as PostRoomLearningService;
    const service = new RoomSpeechProcessingService(
      repository,
      coordinator,
      transcriber,
      safety,
      learning,
      new ConfigService<Environment, true>(
        testEnvironment({
          ROOM_SPEECH_DETECTION_ENABLED: true,
          POST_ROOM_KEYWORDS_ENABLED: true,
        }),
      ),
      { warn: fn() } as unknown as StructuredLogger,
    );
    return {
      service,
      transcriber,
      transcribeWindow,
      close,
      consumeSafety,
      consumeLearning,
      providerAudio: () => providerAudio,
    };
  }

  it('transcribes once and synchronously fans out to both allowed purposes', async () => {
    const test = fixture();
    const audio = new Uint8Array([1, 2, 3, 4]);

    await test.service.processWindow({
      roomId: context.roomId,
      participantIdentity: context.participantIdentity,
      audio,
      mimeType: 'audio/pcm',
      fencingToken: 'fence',
    });

    expect(test.transcriber.openSession).toHaveBeenCalledTimes(1);
    expect(test.transcribeWindow).toHaveBeenCalledTimes(1);
    expect(test.consumeSafety).toHaveBeenCalledTimes(1);
    expect(test.consumeLearning).toHaveBeenCalledTimes(1);
    expect(audio).toEqual(new Uint8Array(audio.byteLength));
    expect(test.providerAudio()).toEqual(new Uint8Array(test.providerAudio()!.byteLength));
    expect(test.close).toHaveBeenCalledTimes(1);
  });

  it('drops all consumer results when any required consent generation changes', async () => {
    const changed = {
      ...context,
      postRoomKeywordsConsentGeneration: 'new-generation',
    };
    const test = fixture([context, changed]);

    await test.service.processWindow({
      roomId: context.roomId,
      participantIdentity: context.participantIdentity,
      audio: new Uint8Array([1, 2]),
      mimeType: 'audio/pcm',
      fencingToken: 'fence',
    });

    expect(test.transcribeWindow).toHaveBeenCalledTimes(1);
    expect(test.consumeSafety).not.toHaveBeenCalled();
    expect(test.consumeLearning).not.toHaveBeenCalled();
  });

  it('keeps one consumer failure from cancelling the other consumer', async () => {
    const test = fixture();
    test.consumeSafety.mockImplementationOnce(async () => {
      throw new Error('risk rules unavailable');
    });

    await test.service.processWindow({
      roomId: context.roomId,
      participantIdentity: context.participantIdentity,
      audio: new Uint8Array([1, 2]),
      mimeType: 'audio/pcm',
      fencingToken: 'fence',
    });

    expect(test.consumeSafety).toHaveBeenCalledTimes(1);
    expect(test.consumeLearning).toHaveBeenCalledTimes(1);
  });
});
