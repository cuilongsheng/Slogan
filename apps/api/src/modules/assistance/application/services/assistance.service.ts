import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../../config/environment.js';
import { StructuredLogger } from '../../../../infrastructure/observability/structured-logger.service.js';
import { RoomsService } from '../../../rooms/index.js';
import type { ExpressionResult } from '../../domain/entities/assistance.js';
import { AssistanceError, type AssistanceErrorCode } from '../../domain/errors/assistance.error.js';
import {
  ASSISTANCE_COORDINATOR,
  type AssistanceCoordinator,
} from '../../domain/ports/assistance-coordinator.port.js';
import {
  ASSISTANCE_MAINTENANCE,
  type AssistanceMaintenance,
} from '../../domain/ports/assistance-maintenance.port.js';
import {
  ASSISTANCE_REPOSITORY,
  type AssistanceRepository,
  type ReservationResult,
} from '../../domain/ports/assistance.repository.js';
import {
  EXPRESSION_GENERATOR,
  type ExpressionGenerator,
} from '../../domain/ports/expression-generator.port.js';
import {
  SPEECH_TRANSCRIBER,
  type SpeechTranscriber,
} from '../../domain/ports/speech-transcriber.port.js';
import { AssistancePolicy } from '../../domain/policies/assistance.policy.js';

@Injectable()
export class AssistanceService {
  constructor(
    @Inject(ASSISTANCE_REPOSITORY) private readonly repository: AssistanceRepository,
    @Inject(ASSISTANCE_COORDINATOR) private readonly coordinator: AssistanceCoordinator,
    @Inject(EXPRESSION_GENERATOR) private readonly generator: ExpressionGenerator,
    @Inject(SPEECH_TRANSCRIBER) private readonly transcriber: SpeechTranscriber,
    @Inject(ASSISTANCE_MAINTENANCE) private readonly maintenance: AssistanceMaintenance,
    private readonly rooms: RoomsService,
    private readonly policy: AssistancePolicy,
    private readonly config: ConfigService<Environment, true>,
    private readonly logger: StructuredLogger,
  ) {}

  consentState(userId: string) {
    return this.repository.consentState(
      userId,
      'AI_EXPRESSION_AUDIO',
      this.config.get('ASSISTANCE_NOTICE_VERSION', { infer: true }),
    );
  }

  roomConsentState(userId: string) {
    return this.repository.consentState(
      userId,
      'ROOM_SAFETY_DETECTION',
      this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true }),
    );
  }

  postRoomKeywordsConsentState(userId: string) {
    return this.repository.consentState(
      userId,
      'POST_ROOM_KEYWORDS',
      this.config.get('POST_ROOM_KEYWORDS_NOTICE_VERSION', { infer: true }),
    );
  }

  async changeConsent(
    userId: string,
    input: { clientRequestId: string; action: 'ACCEPT' | 'REVOKE'; noticeVersion: string },
    now = new Date(),
  ) {
    if (!this.config.get('ASSISTANCE_AUDIO_ENABLED', { infer: true })) this.unavailable();
    const currentVersion = this.config.get('ASSISTANCE_NOTICE_VERSION', { infer: true });
    if (input.noticeVersion !== currentVersion)
      throw new AssistanceError(
        'ASSISTANCE_CONSENT_REQUIRED',
        'Current speech processing notice must be accepted',
        { noticeVersion: currentVersion },
      );
    return this.repository.consent({
      ...input,
      userId,
      now,
      providerCategory: this.transcriber.category,
      purpose: 'AI_EXPRESSION_AUDIO',
    });
  }

  async changeRoomConsent(
    userId: string,
    input: { clientRequestId: string; action: 'ACCEPT' | 'REVOKE'; noticeVersion: string },
    now = new Date(),
  ) {
    if (!this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true })) this.unavailable();
    const currentVersion = this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true });
    if (input.noticeVersion !== currentVersion)
      throw new AssistanceError(
        'ASSISTANCE_CONSENT_REQUIRED',
        'Current room speech processing notice must be accepted',
        { noticeVersion: currentVersion },
      );
    return this.repository.consent({
      ...input,
      userId,
      now,
      purpose: 'ROOM_SAFETY_DETECTION',
      providerCategory: this.config.get('STT_PROVIDER_CATEGORY', { infer: true })!,
    });
  }

  async changePostRoomKeywordsConsent(
    userId: string,
    input: { clientRequestId: string; action: 'ACCEPT' | 'REVOKE'; noticeVersion: string },
    now = new Date(),
  ) {
    if (!this.config.get('POST_ROOM_KEYWORDS_ENABLED', { infer: true }))
      throw new AssistanceError(
        'POST_ROOM_KEYWORDS_UNAVAILABLE',
        'Post-room keywords are unavailable',
      );
    const currentVersion = this.config.get('POST_ROOM_KEYWORDS_NOTICE_VERSION', { infer: true });
    if (input.noticeVersion !== currentVersion)
      throw new AssistanceError(
        'POST_ROOM_KEYWORDS_CONSENT_REQUIRED',
        'Current post-room keyword processing notice must be accepted',
        { noticeVersion: currentVersion },
      );
    return this.repository.consent({
      ...input,
      userId,
      now,
      purpose: 'POST_ROOM_KEYWORDS',
      providerCategory: this.config.get('STT_PROVIDER_CATEGORY', { infer: true })!,
    });
  }

  async text(
    userId: string,
    roomId: string,
    input: { clientRequestId: string; text: string },
    now = new Date(),
  ): Promise<ExpressionResult> {
    const startedAt = Date.now();
    this.assertEnabled();
    const context = await this.rooms.assistanceContext(userId, roomId, now);
    const text = this.policy.normalizeText(input.text);
    const digest = this.policy.digest({ roomId, mode: 'TEXT', value: text });
    const permit = await this.coordinator.acquire(userId);
    let active: { requestId: string; leaseToken: string } | undefined;
    try {
      const reservation = await this.repository.reserve({
        userId,
        roomId,
        clientRequestId: input.clientRequestId,
        mode: 'TEXT',
        digest,
        inputSize: [...text].length,
        audioReservedSeconds: 0,
        now,
      });
      const handled = this.handleReservation(reservation);
      if ('result' in handled) return handled.result;
      active = handled;
      await this.repository.transition({
        ...active,
        from: ['RESERVED', 'UNCERTAIN'],
        to: 'AI_RUNNING',
        providerCategory: this.generator.category,
      });
      const generated = await this.generator.generate({
        requestId: active.requestId,
        text,
        topic: context.topic,
        cefrLevel: context.cefrLevel,
      });
      await this.repository.recordUsage(active.requestId, 'AI_EXPRESSION', generated.usageUnits);
      const result = await this.complete(active, generated.output, now);
      this.success(active.requestId, 'TEXT', 'AI', startedAt);
      return result;
    } catch (error) {
      await this.recordFailure(active, error, now);
      this.failure(active?.requestId, 'TEXT', 'AI', startedAt, error);
      throw error;
    } finally {
      await permit.release();
    }
  }

  async audio(
    userId: string,
    roomId: string,
    input: {
      clientRequestId: string;
      noticeVersion: string;
      noticeConfirmed: boolean;
      sourceLanguageCode?: string;
      audio: Uint8Array;
      mimeType: string;
    },
    now = new Date(),
  ): Promise<ExpressionResult> {
    const startedAt = Date.now();
    this.assertEnabled();
    if (!this.config.get('ASSISTANCE_AUDIO_ENABLED', { infer: true })) this.unavailable();
    const context = await this.rooms.assistanceContext(userId, roomId, now);
    const currentVersion = this.config.get('ASSISTANCE_NOTICE_VERSION', { infer: true });
    const consent = await this.repository.consentState(
      userId,
      'AI_EXPRESSION_AUDIO',
      currentVersion,
    );
    if (
      consent.status !== 'ACCEPTED' ||
      input.noticeVersion !== currentVersion ||
      input.noticeConfirmed !== true
    )
      throw new AssistanceError(
        'ASSISTANCE_CONSENT_REQUIRED',
        'Speech processing consent is required',
        { noticeVersion: currentVersion },
      );
    this.policy.assertAudio({ buffer: input.audio, mimeType: input.mimeType });
    const digest = this.policy.digest({ roomId, mode: 'AUDIO', value: input.audio });
    const permit = await this.coordinator.acquire(userId);
    let active: { requestId: string; leaseToken: string } | undefined;
    let phase = 'STT';
    try {
      const reservation = await this.repository.reserve({
        userId,
        roomId,
        clientRequestId: input.clientRequestId,
        mode: 'AUDIO',
        digest,
        inputSize: input.audio.byteLength,
        audioReservedSeconds: 30,
        now,
      });
      const handled = this.handleReservation(reservation);
      if ('result' in handled) return handled.result;
      active = handled;
      await this.repository.transition({
        ...active,
        from: ['RESERVED', 'UNCERTAIN'],
        to: 'STT_RUNNING',
        providerCategory: this.transcriber.category,
      });
      const speech = await this.transcriber.transcribe({
        requestId: active.requestId,
        audio: input.audio,
        mimeType: input.mimeType,
        ...(input.sourceLanguageCode ? { sourceLanguageCode: input.sourceLanguageCode } : {}),
      });
      await this.repository.recordUsage(active.requestId, 'STT_AUDIO', speech.usageUnits);
      if (speech.durationMs > 30_000)
        throw new AssistanceError('ASSISTANCE_AUDIO_INVALID', 'Audio duration exceeds the limit');
      await this.repository.transition({
        ...active,
        from: ['STT_RUNNING'],
        to: 'AI_RUNNING',
        providerCategory: `${this.transcriber.category}/${this.generator.category}`.slice(0, 64),
        audioDurationMs: speech.durationMs,
      });
      phase = 'AI';
      const generated = await this.generator.generate({
        requestId: active.requestId,
        text: speech.transcript,
        topic: context.topic,
        cefrLevel: context.cefrLevel,
      });
      await this.repository.recordUsage(active.requestId, 'AI_EXPRESSION', generated.usageUnits);
      const result = await this.complete(active, generated.output, now);
      this.success(active.requestId, 'AUDIO', phase, startedAt);
      return result;
    } catch (error) {
      await this.recordFailure(active, error, now);
      this.failure(active?.requestId, 'AUDIO', phase, startedAt, error);
      throw error;
    } finally {
      await permit.release();
    }
  }

  private async complete(
    active: { requestId: string; leaseToken: string },
    output: Parameters<AssistanceRepository['succeed']>[0]['output'],
    now: Date,
  ) {
    const expiresAt = new Date(
      now.getTime() + this.config.get('ASSISTANCE_OUTPUT_TTL_SECONDS', { infer: true }) * 1000,
    );
    const result = await this.repository.succeed({
      ...active,
      output,
      generatedAt: now,
      expiresAt,
    });
    await this.maintenance.scheduleExpiry(active.requestId, expiresAt);
    return result;
  }

  private handleReservation(
    reservation: ReservationResult,
  ): { requestId: string; leaseToken: string } | { result: ExpressionResult } {
    if (reservation.kind === 'NEW') return reservation;
    if (reservation.kind === 'REPLAY') return { result: reservation.result };
    if (reservation.kind === 'EXPIRED')
      throw new AssistanceError('ASSISTANCE_RESULT_EXPIRED', 'Assistance result expired');
    if (reservation.kind === 'IN_PROGRESS')
      throw new AssistanceError('ASSISTANCE_IN_PROGRESS', 'Assistance request is in progress', {
        retryAfterSeconds: reservation.retryAfterSeconds,
      });
    throw new AssistanceError(
      reservation.errorCode as AssistanceErrorCode,
      'Assistance request previously failed',
    );
  }

  private async recordFailure(
    active: { requestId: string; leaseToken: string } | undefined,
    error: unknown,
    now: Date,
  ) {
    if (!active) return;
    const code =
      error instanceof AssistanceError ? error.code : ('ASSISTANCE_REQUEST_FAILED' as const);
    await this.repository.fail({
      ...active,
      errorCode: code,
      uncertain: ['ASSISTANCE_PROVIDER_TIMEOUT', 'ASSISTANCE_PROVIDER_UNAVAILABLE'].includes(code),
      at: now,
    });
  }

  private assertEnabled(): void {
    if (!this.config.get('ASSISTANCE_ENABLED', { infer: true })) this.unavailable();
  }

  private unavailable(): never {
    throw new AssistanceError('ASSISTANCE_UNAVAILABLE', 'Expression assistance is unavailable');
  }

  private success(
    requestId: string,
    inputMode: 'TEXT' | 'AUDIO',
    phase: string,
    startedAt: number,
  ) {
    this.logger.log({
      event: 'assistance_request_completed',
      requestId,
      inputMode,
      phase,
      durationMs: Date.now() - startedAt,
      resultCode: 'SUCCEEDED',
    });
  }

  private failure(
    requestId: string | undefined,
    inputMode: 'TEXT' | 'AUDIO',
    phase: string,
    startedAt: number,
    error: unknown,
  ) {
    this.logger.warn({
      event: 'assistance_request_failed',
      requestId,
      inputMode,
      phase,
      durationMs: Date.now() - startedAt,
      resultCode: error instanceof AssistanceError ? error.code : 'ASSISTANCE_REQUEST_FAILED',
    });
  }
}
