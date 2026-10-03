import { ConfigService } from '@nestjs/config';
import { fn } from 'jest-mock';
import type { Environment } from '../../src/config/environment.js';
import {
  RoomSpeechSafetyService,
  RoomSpeechRiskPolicy,
} from '../../src/modules/speech-safety/index.js';
import type { RoomSpeechRepository } from '../../src/modules/speech-safety/domain/ports/room-speech.repository.js';
import type { RoomSpeechCoordinator } from '../../src/modules/speech-safety/domain/ports/room-speech-coordinator.port.js';
import type { RoomSpeechTranscriber } from '../../src/modules/speech-safety/index.js';
import type { RealtimeProvider } from '../../src/modules/voice/index.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('RoomSpeechSafetyService', () => {
  it('zeroes temporary audio and persists only a minimal risk event after fencing and consent checks', async () => {
    const context = {
      roomId: '00000000-0000-4000-8000-000000000001',
      userId: '00000000-0000-4000-8000-000000000002',
      participantIdentity: '00000000-0000-4000-8000-000000000003',
      consentGeneration: '00000000-0000-4000-8000-000000000004',
      roomEndsAt: new Date(Date.now() + 60_000),
    };
    const recordRisk = fn(async (input: Parameters<RoomSpeechRepository['recordRisk']>[0]) => ({
      id: '00000000-0000-4000-8000-000000000005',
      roomId: input.context.roomId,
      subjectUserId: input.context.userId,
      category: input.classification.category,
      severity: input.classification.severity,
      ruleSetVersion: input.classification.ruleSetVersion,
      firstOccurredAt: input.occurredAt,
      lastOccurredAt: input.occurredAt,
      occurrenceCount: 1,
    }));
    const repository = {
      participant: fn(async () => context),
      recordRisk,
      recoverIncident: fn(async () => undefined),
      openIncident: fn(async () => {
        throw new Error('not expected');
      }),
    } as unknown as RoomSpeechRepository;
    const coordinator = {
      renewRoom: fn(async () => true),
      allowRisk: fn(async () => true),
    } as unknown as RoomSpeechCoordinator;
    let providerAudio: Uint8Array | undefined;
    const close = fn(async () => undefined);
    const transcribeWindow = fn(
      async (
        input: Parameters<
          Awaited<ReturnType<RoomSpeechTranscriber['openSession']>>['transcribeWindow']
        >[0],
      ) => {
        providerAudio = input.audio;
        return {
          transcript: 'I will attack you',
          durationMs: 1000,
          usageUnits: 1,
        };
      },
    );
    const transcriber = {
      category: 'TEST_STT',
      healthCheck: fn(async () => undefined),
      deletionAssurance: fn(async () => ({
        mode: 'NO_RETENTION' as const,
        result: 'COMPLETED' as const,
      })),
      openSession: fn(async () => ({ transcribeWindow, close })),
    } satisfies RoomSpeechTranscriber;
    const realtime = {} as RealtimeProvider;
    const config = new ConfigService<Environment, true>(
      testEnvironment({
        ROOM_SPEECH_DETECTION_ENABLED: true,
        ROOM_SPEECH_HASH_SECRET: 'room-speech-test-secret-at-least-32-characters',
        ROOM_SPEECH_RULE_SET_VERSION: 'rules-v1',
      }),
    );
    const service = new RoomSpeechSafetyService(
      repository,
      coordinator,
      transcriber,
      realtime,
      new RoomSpeechRiskPolicy(config),
      config,
    );
    const audio = new Uint8Array([1, 2, 3, 4]);

    const result = await service.processWindow({
      roomId: context.roomId,
      participantIdentity: context.participantIdentity,
      audio,
      mimeType: 'audio/pcm',
      fencingToken: 'fence-1',
      observedConsentGeneration: context.consentGeneration,
    });

    expect(result?.category).toBe('THREAT_VIOLENCE');
    expect(audio).toEqual(new Uint8Array([0, 0, 0, 0]));
    expect(providerAudio).toBeDefined();
    expect(providerAudio).toEqual(new Uint8Array(providerAudio!.byteLength));
    expect(close).toHaveBeenCalledTimes(1);
    expect(recordRisk).toHaveBeenCalledTimes(1);
    const saved = recordRisk.mock.calls[0]![0];
    expect(saved).not.toHaveProperty('transcript');
    expect(saved).not.toHaveProperty('audio');
    expect(saved.correlationHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('drops a stale consent generation before provider processing and still clears audio', async () => {
    const repository = {
      participant: fn(async () => ({
        roomId: 'r',
        userId: 'u',
        participantIdentity: 'p',
        consentGeneration: 'new',
        roomEndsAt: new Date(Date.now() + 60_000),
      })),
    } as unknown as RoomSpeechRepository;
    const coordinator = {
      renewRoom: fn(async () => true),
    } as unknown as RoomSpeechCoordinator;
    const transcriber = {
      category: 'TEST_STT',
      openSession: fn(),
    } as unknown as RoomSpeechTranscriber;
    const config = new ConfigService<Environment, true>(
      testEnvironment({
        ROOM_SPEECH_HASH_SECRET: 'room-speech-test-secret-at-least-32-characters',
      }),
    );
    const service = new RoomSpeechSafetyService(
      repository,
      coordinator,
      transcriber,
      {} as RealtimeProvider,
      new RoomSpeechRiskPolicy(config),
      config,
    );
    const audio = new Uint8Array([9, 8]);

    await expect(
      service.processWindow({
        roomId: 'r',
        participantIdentity: 'p',
        audio,
        mimeType: 'audio/pcm',
        fencingToken: 'f',
        observedConsentGeneration: 'old',
      }),
    ).resolves.toBeNull();

    expect(transcriber.openSession).not.toHaveBeenCalled();
    expect(audio).toEqual(new Uint8Array([0, 0]));
  });

  it('cancels an active provider session without recording degradation when a participant leaves', async () => {
    const context = {
      roomId: 'room',
      userId: 'user',
      participantIdentity: 'participant',
      consentGeneration: 'consent',
      roomEndsAt: new Date(Date.now() + 60_000),
    };
    const openIncident = fn(async () => {
      throw new Error('not expected');
    });
    const repository = {
      participant: fn(async () => context),
      openIncident,
    } as unknown as RoomSpeechRepository;
    const coordinator = {
      renewRoom: fn(async () => true),
    } as unknown as RoomSpeechCoordinator;
    let rejectWindow: ((error: Error) => void) | undefined;
    const close = fn(async () => rejectWindow?.(new Error('cancelled')));
    const transcriber = {
      category: 'TEST_STT',
      healthCheck: fn(async () => undefined),
      deletionAssurance: fn(async () => ({
        mode: 'NO_RETENTION' as const,
        result: 'COMPLETED' as const,
      })),
      openSession: fn(async () => ({
        transcribeWindow: () =>
          new Promise<never>((_resolve, reject) => {
            rejectWindow = reject;
          }),
        close,
      })),
    } satisfies RoomSpeechTranscriber;
    const config = new ConfigService<Environment, true>(
      testEnvironment({
        ROOM_SPEECH_HASH_SECRET: 'room-speech-test-secret-at-least-32-characters',
      }),
    );
    const service = new RoomSpeechSafetyService(
      repository,
      coordinator,
      transcriber,
      {} as RealtimeProvider,
      new RoomSpeechRiskPolicy(config),
      config,
    );
    const audio = new Uint8Array([7, 6, 5]);
    const processing = service.processWindow({
      roomId: context.roomId,
      participantIdentity: context.participantIdentity,
      audio,
      mimeType: 'audio/pcm',
      fencingToken: 'fence',
    });
    while (!rejectWindow) await Promise.resolve();
    await service.cancelParticipant(context.roomId, context.participantIdentity);

    await expect(processing).resolves.toBeNull();
    expect(close).toHaveBeenCalled();
    expect(openIncident).not.toHaveBeenCalled();
    expect(audio).toEqual(new Uint8Array(audio.byteLength));
  });

  it('drops a provider result when consent generation changes during transcription', async () => {
    const context = {
      roomId: 'room',
      userId: 'user',
      participantIdentity: 'participant',
      consentGeneration: 'old-consent',
      roomEndsAt: new Date(Date.now() + 60_000),
    };
    const recordRisk = fn();
    const participant = fn<RoomSpeechRepository['participant']>()
      .mockResolvedValueOnce(context)
      .mockResolvedValueOnce({ ...context, consentGeneration: 'new-consent' });
    const repository = {
      participant,
      recordRisk,
      recoverIncident: fn(async () => undefined),
    } as unknown as RoomSpeechRepository;
    const coordinator = {
      renewRoom: fn(async () => true),
    } as unknown as RoomSpeechCoordinator;
    const close = fn(async () => undefined);
    const transcriber = {
      category: 'TEST_STT',
      healthCheck: fn(async () => undefined),
      deletionAssurance: fn(async () => ({
        mode: 'NO_RETENTION' as const,
        result: 'COMPLETED' as const,
      })),
      openSession: fn(async () => ({
        transcribeWindow: fn(async () => ({
          transcript: 'I will attack you',
          durationMs: 1000,
          usageUnits: 1,
        })),
        close,
      })),
    } satisfies RoomSpeechTranscriber;
    const config = new ConfigService<Environment, true>(
      testEnvironment({
        ROOM_SPEECH_HASH_SECRET: 'room-speech-test-secret-at-least-32-characters',
      }),
    );
    const service = new RoomSpeechSafetyService(
      repository,
      coordinator,
      transcriber,
      {} as RealtimeProvider,
      new RoomSpeechRiskPolicy(config),
      config,
    );
    const audio = new Uint8Array([4, 3, 2, 1]);

    await expect(
      service.processWindow({
        roomId: context.roomId,
        participantIdentity: context.participantIdentity,
        audio,
        mimeType: 'audio/pcm',
        fencingToken: 'fence',
        observedConsentGeneration: 'old-consent',
      }),
    ).resolves.toBeNull();
    expect(recordRisk).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(audio).toEqual(new Uint8Array(audio.byteLength));
  });
});
