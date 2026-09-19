import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import { PostRoomLearningService } from '../../post-room-learning/index.js';
import {
  ROOM_SPEECH_COORDINATOR,
  ROOM_SPEECH_TRANSCRIBER,
  RoomSpeechSafetyService,
  type RoomSpeechCoordinator,
  type RoomSpeechTranscriber,
  type RoomSpeechTranscriptionSession,
  type SpeechAudioWindow,
} from '../../speech-safety/index.js';
import type { RoomSpeechPurposeContext } from '../domain/room-speech-processing.js';
import {
  ROOM_SPEECH_PROCESSING_REPOSITORY,
  type RoomSpeechProcessingRepository,
} from '../domain/room-speech-processing.repository.js';

@Injectable()
export class RoomSpeechProcessingService {
  private readonly sessions = new Map<string, RoomSpeechTranscriptionSession>();

  constructor(
    @Inject(ROOM_SPEECH_PROCESSING_REPOSITORY)
    private readonly repository: RoomSpeechProcessingRepository,
    @Inject(ROOM_SPEECH_COORDINATOR) private readonly coordinator: RoomSpeechCoordinator,
    @Inject(ROOM_SPEECH_TRANSCRIBER) private readonly transcriber: RoomSpeechTranscriber,
    private readonly safety: RoomSpeechSafetyService,
    private readonly learning: PostRoomLearningService,
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}

  activeRooms() {
    return this.repository.activeRooms({
      safetyEnabled: this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true }),
      postRoomKeywordsEnabled: this.config.get('POST_ROOM_KEYWORDS_ENABLED', { infer: true }),
      now: new Date(),
    });
  }

  healthCheck() {
    return this.transcriber.healthCheck();
  }

  async processWindow(input: SpeechAudioWindow & { fencingToken: string }) {
    const audio = input.audio;
    const sessionKey = `${input.roomId}:${input.participantIdentity}`;
    let session: RoomSpeechTranscriptionSession | undefined;
    try {
      if (!(await this.coordinator.renewRoom(input.roomId, input.fencingToken))) return null;
      const context = await this.context(input.roomId, input.participantIdentity);
      if (!context || this.sessions.has(sessionKey)) return null;
      const before = this.generation(context);
      let providerAudio: Uint8Array | undefined;
      let transcript: string;
      try {
        session = await this.transcriber.openSession({
          anonymousSessionId: createHash('sha256')
            .update(`${input.roomId}:${before}`)
            .digest('hex'),
        });
        this.sessions.set(sessionKey, session);
        providerAudio = this.wav(audio);
        transcript = (
          await session.transcribeWindow({
            requestId: randomUUID(),
            audio: providerAudio,
            mimeType: 'audio/wav',
            ...(input.sourceLanguageCode ? { sourceLanguageCode: input.sourceLanguageCode } : {}),
          })
        ).transcript;
      } catch {
        await this.safety.degrade(
          input.roomId,
          'STREAMING_STT',
          'PROVIDER_UNAVAILABLE',
          this.transcriber.category,
        );
        return null;
      } finally {
        providerAudio?.fill(0);
        await session?.close();
        if (this.sessions.get(sessionKey) === session) this.sessions.delete(sessionKey);
      }
      const after = await this.context(input.roomId, input.participantIdentity);
      if (!after || this.generation(after) !== before) return null;
      const consumers: Promise<unknown>[] = [];
      if (after.safety)
        consumers.push(
          this.safety.consumeTranscript({
            context: after.safety,
            transcript,
            fencingToken: input.fencingToken,
          }),
        );
      if (after.postRoomKeywordsConsentGeneration)
        consumers.push(
          this.learning.consumeTranscript({
            roomId: input.roomId,
            transcript,
            fencingToken: input.fencingToken,
          }),
        );
      const results = await Promise.allSettled(consumers);
      if (results.some(({ status }) => status === 'rejected'))
        this.logger.warn({ event: 'room_speech_consumer_degraded', roomId: input.roomId });
      return results;
    } finally {
      audio.fill(0);
    }
  }

  async cancelParticipant(roomId: string, participantIdentity: string) {
    const key = `${roomId}:${participantIdentity}`;
    const session = this.sessions.get(key);
    this.sessions.delete(key);
    await session?.close();
  }

  async cancelRoom(roomId: string) {
    const sessions = [...this.sessions].filter(([key]) => key.startsWith(`${roomId}:`));
    for (const [key] of sessions) this.sessions.delete(key);
    await Promise.allSettled(sessions.map(([, session]) => session.close()));
  }

  deliverPending() {
    return this.safety.deliverPending();
  }

  reconcileFinalization() {
    return this.learning.reconcileFinalization();
  }

  maintenance() {
    return this.learning.purge();
  }

  degrade(...args: Parameters<RoomSpeechSafetyService['degrade']>) {
    return this.safety.degrade(...args);
  }

  recoverIncident(...args: Parameters<RoomSpeechSafetyService['recoverIncident']>) {
    return this.safety.recoverIncident(...args);
  }

  private context(roomId: string, participantIdentity: string) {
    return this.repository.participant({
      roomId,
      participantIdentity,
      safetyNoticeVersion: this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true }),
      postRoomKeywordsNoticeVersion: this.config.get('POST_ROOM_KEYWORDS_NOTICE_VERSION', {
        infer: true,
      }),
    });
  }

  private generation(context: RoomSpeechPurposeContext) {
    return `${context.safety?.consentGeneration ?? ''}:${context.postRoomKeywordsConsentGeneration ?? ''}`;
  }

  private wav(pcm: Uint8Array): Uint8Array {
    const output = new Uint8Array(44 + pcm.byteLength);
    const view = new DataView(output.buffer);
    const write = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1)
        output[offset + index] = value.charCodeAt(index);
    };
    write(0, 'RIFF');
    view.setUint32(4, 36 + pcm.byteLength, true);
    write(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 16_000, true);
    view.setUint32(28, 32_000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, 'data');
    view.setUint32(40, pcm.byteLength, true);
    output.set(pcm, 44);
    return output;
  }
}
