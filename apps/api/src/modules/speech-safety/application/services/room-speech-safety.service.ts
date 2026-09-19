import { createHmac, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../../../common/errors/app-error.js';
import type { Environment } from '../../../../config/environment.js';
import { REALTIME_PROVIDER, type RealtimeProvider } from '../../../voice/index.js';
import type {
  SafetyCapabilityComponent,
  SpeechAudioWindow,
} from '../../domain/entities/room-speech-safety.js';
import {
  ROOM_SPEECH_COORDINATOR,
  type RoomSpeechCoordinator,
} from '../../domain/ports/room-speech-coordinator.port.js';
import {
  ROOM_SPEECH_REPOSITORY,
  type RoomSpeechRepository,
} from '../../domain/ports/room-speech.repository.js';
import { RoomSpeechRiskPolicy } from '../../domain/policies/room-speech-risk.policy.js';
import {
  ROOM_SPEECH_TRANSCRIBER,
  type RoomSpeechTranscriber,
  type RoomSpeechTranscriptionSession,
} from '../../domain/ports/room-speech-transcriber.port.js';

@Injectable()
export class RoomSpeechSafetyService {
  private readonly activeSessions = new Map<string, RoomSpeechTranscriptionSession>();

  constructor(
    @Inject(ROOM_SPEECH_REPOSITORY) private readonly repository: RoomSpeechRepository,
    @Inject(ROOM_SPEECH_COORDINATOR) private readonly coordinator: RoomSpeechCoordinator,
    @Inject(ROOM_SPEECH_TRANSCRIBER) private readonly transcriber: RoomSpeechTranscriber,
    @Inject(REALTIME_PROVIDER) private readonly realtime: RealtimeProvider,
    private readonly policy: RoomSpeechRiskPolicy,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  activeRooms() {
    return this.repository.activeRooms();
  }

  healthCheck() {
    return this.transcriber.healthCheck();
  }

  async processWindow(input: SpeechAudioWindow & { fencingToken: string }) {
    const audio = input.audio;
    const activeKey = `${input.roomId}:${input.participantIdentity}`;
    let session: RoomSpeechTranscriptionSession | undefined;
    try {
      if (!(await this.coordinator.renewRoom(input.roomId, input.fencingToken))) return null;
      const context = await this.repository.participant(
        input.roomId,
        input.participantIdentity,
        this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true }),
      );
      if (
        !context ||
        (input.observedConsentGeneration &&
          context.consentGeneration !== input.observedConsentGeneration)
      )
        return null;
      if (this.activeSessions.has(activeKey)) {
        await this.degrade(input.roomId, 'STREAMING_STT', 'WINDOW_CONCURRENCY_LIMIT');
        return null;
      }
      let transcript: string;
      let providerAudio: Uint8Array | undefined;
      try {
        session = await this.transcriber.openSession({
          anonymousSessionId: this.hash([
            'speech-session',
            input.roomId,
            input.participantIdentity,
            context.consentGeneration,
          ]),
        });
        this.activeSessions.set(activeKey, session);
        providerAudio = this.wav(audio);
        const result = await session.transcribeWindow({
          requestId: randomUUID(),
          audio: providerAudio,
          mimeType: 'audio/wav',
          ...(input.sourceLanguageCode ? { sourceLanguageCode: input.sourceLanguageCode } : {}),
        });
        transcript = result.transcript;
        await this.repository.recoverIncident({
          roomId: input.roomId,
          component: 'STREAMING_STT',
          errorCategory: 'PROVIDER_UNAVAILABLE',
          now: new Date(),
        });
      } catch {
        if (session && this.activeSessions.get(activeKey) !== session) return null;
        await this.degrade(
          input.roomId,
          'STREAMING_STT',
          'PROVIDER_UNAVAILABLE',
          this.transcriber.category,
        );
        return null;
      } finally {
        providerAudio?.fill(0);
        await session?.close();
        if (this.activeSessions.get(activeKey) === session) this.activeSessions.delete(activeKey);
      }
      const currentContext = await this.repository.participant(
        input.roomId,
        input.participantIdentity,
        this.config.get('ROOM_SPEECH_NOTICE_VERSION', { infer: true }),
      );
      if (!currentContext || currentContext.consentGeneration !== context.consentGeneration) {
        transcript = '';
        return null;
      }
      const result = await this.consumeTranscript({
        context,
        transcript,
        fencingToken: input.fencingToken,
      });
      transcript = '';
      return result;
    } finally {
      audio.fill(0);
    }
  }

  async consumeTranscript(input: {
    context: import('../../domain/entities/room-speech-safety.js').SpeechParticipantContext;
    transcript: string;
    fencingToken: string;
  }) {
    let classification;
    try {
      classification = this.policy.classify(input.transcript);
    } catch {
      await this.degrade(input.context.roomId, 'RISK_RULES', 'RULE_EXECUTION_FAILED');
      return null;
    }
    if (!classification) return null;
    const bucket = Math.floor(Date.now() / 30_000);
    const hash = this.hash([
      input.context.roomId,
      input.context.userId,
      classification.category,
      classification.ruleSetVersion,
      String(bucket),
    ]);
    let allowed: boolean;
    try {
      allowed = await this.coordinator.allowRisk(hash, 30, 3);
    } catch {
      await this.degrade(input.context.roomId, 'COORDINATION', 'DEDUP_UNAVAILABLE');
      return null;
    }
    if (!allowed) return null;
    if (!(await this.coordinator.renewRoom(input.context.roomId, input.fencingToken))) return null;
    return this.repository.recordRisk({
      context: input.context,
      classification,
      correlationHash: hash,
      occurredAt: new Date(),
      alertTtlSeconds: this.config.get('ROOM_SPEECH_ALERT_TTL_SECONDS', { infer: true }),
      fencingToken: input.fencingToken,
    });
  }

  async cancelParticipant(roomId: string, participantIdentity: string): Promise<void> {
    const key = `${roomId}:${participantIdentity}`;
    const session = this.activeSessions.get(key);
    this.activeSessions.delete(key);
    await session?.close();
  }

  async cancelRoom(roomId: string): Promise<void> {
    const sessions = [...this.activeSessions].filter(([key]) => key.startsWith(`${roomId}:`));
    for (const [key] of sessions) this.activeSessions.delete(key);
    await Promise.allSettled(sessions.map(([, session]) => session.close()));
  }

  listHostAlerts(actorUserId: string, roomId: string, cursor?: string, limit = 20) {
    return this.repository.listHostAlerts({
      actorUserId,
      roomId,
      ...(cursor ? { cursor } : {}),
      limit,
      now: new Date(),
    });
  }

  listIncidents(input: Parameters<RoomSpeechRepository['listIncidents']>[0]) {
    if (input.from && input.to && input.from > input.to)
      throw new AppError('VALIDATION_FAILED', 'Request validation failed', 400);
    return this.repository.listIncidents(input);
  }

  degrade(
    roomId: string | undefined,
    component: SafetyCapabilityComponent,
    errorCategory: string,
    providerCategory?: string,
  ) {
    return this.repository.openIncident({
      ...(roomId ? { roomId } : {}),
      component,
      errorCategory,
      ...(providerCategory ? { providerCategory } : {}),
      now: new Date(),
    });
  }

  recoverIncident(input: Parameters<RoomSpeechRepository['recoverIncident']>[0]) {
    return this.repository.recoverIncident(input);
  }

  async deliverPending() {
    for (const delivery of await this.repository.claimDeliveries()) {
      const targetIdentity = await this.repository.resolveDeliveryTarget(
        delivery.id,
        delivery.leaseId,
      );
      if (!targetIdentity) {
        await this.repository.failDelivery(
          delivery.id,
          delivery.leaseId,
          'HOST_OFFLINE',
          new Date(),
        );
        continue;
      }
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            version: 1,
            type: 'ROOM_SAFETY_ALERT',
            alert: {
              id: delivery.alert.id,
              roomId: delivery.alert.roomId,
              subjectUserId: delivery.alert.subjectUserId,
              category: delivery.alert.category,
              severity: delivery.alert.severity,
              ruleSetVersion: delivery.alert.ruleSetVersion,
              occurredAt: delivery.alert.lastOccurredAt.toISOString(),
              noticeCode: 'REQUIRES_HUMAN_REVIEW',
            },
          }),
        );
        await this.realtime.sendData(delivery.roomId, payload, [targetIdentity]);
        await this.repository.completeDelivery(delivery.id, delivery.leaseId, new Date());
      } catch {
        await this.repository.failDelivery(
          delivery.id,
          delivery.leaseId,
          'DELIVERY_UNAVAILABLE',
          new Date(),
        );
        await this.degrade(delivery.roomId, 'HOST_ALERT_DELIVERY', 'DELIVERY_UNAVAILABLE');
      }
    }
  }

  async purge(now = new Date()) {
    const days = this.config.get('ROOM_SPEECH_RETENTION_DAYS', { infer: true });
    return this.repository.purge(new Date(now.getTime() - days * 86_400_000));
  }

  private hash(parts: string[]) {
    return createHmac(
      'sha256',
      this.config.get('ROOM_SPEECH_HASH_SECRET', { infer: true }) ?? 'test-disabled-secret',
    )
      .update(parts.join(':'))
      .digest('hex');
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
