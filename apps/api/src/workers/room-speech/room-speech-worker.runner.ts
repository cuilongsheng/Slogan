import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service.js';
import { RoomSpeechReadinessStore } from '../../infrastructure/redis/room-speech-readiness.service.js';
import {
  ROOM_SPEECH_COORDINATOR,
  ROOM_MEDIA_SOURCE,
  type RoomSpeechCoordinator,
  type RoomMediaSession,
  type RoomMediaSource,
} from '../../modules/speech-safety/index.js';
import { RoomSpeechProcessingService } from '../../modules/room-speech-processing/index.js';

interface ActiveSession {
  fencingToken: string;
  media: RoomMediaSession;
  endsAt: Date;
  buffers: Map<
    string,
    { chunks: Uint8Array[]; bytes: number; startedAt: number; lastVoiceAt: number }
  >;
}

@Injectable()
export class RoomSpeechWorkerRunner implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  private readonly sessions = new Map<string, ActiveSession>();
  private readonly pendingWindows = new Set<Promise<unknown>>();
  private stopped = false;
  private ready = false;
  private lastMaintenanceAt = 0;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly service: RoomSpeechProcessingService,
    @Inject(ROOM_SPEECH_COORDINATOR) private readonly coordinator: RoomSpeechCoordinator,
    @Inject(ROOM_MEDIA_SOURCE) private readonly mediaSource: RoomMediaSource,
    private readonly logger: StructuredLogger,
    private readonly readiness: RoomSpeechReadinessStore,
  ) {}

  onModuleInit() {
    if (
      !this.config.get('ROOM_SPEECH_DETECTION_ENABLED', { infer: true }) &&
      !this.config.get('POST_ROOM_KEYWORDS_ENABLED', { infer: true })
    )
      return;
    this.tick();
    this.timer = setInterval(() => this.tick(), 5000);
    this.timer.unref();
  }

  health() {
    return {
      live: !this.stopped,
      ready: !this.stopped && this.ready,
      activeRooms: this.sessions.size,
    };
  }

  private tick() {
    if (this.running || this.stopped) return;
    this.running = this.reconcile()
      .catch(async () => {
        try {
          await this.service.degrade(undefined, 'COORDINATION', 'WORKER_RECOVERY_UNAVAILABLE');
        } catch {
          // PostgreSQL itself may be the unavailable dependency.
        }
        this.logger.warn('room_speech_worker_recovery_unavailable');
      })
      .finally(() => {
        this.running = undefined;
      });
  }

  async reconcile() {
    let discoveredRooms: Awaited<ReturnType<RoomSpeechProcessingService['activeRooms']>>;
    try {
      await Promise.all([
        this.coordinator.healthCheck(),
        this.mediaSource.healthCheck(),
        this.service.healthCheck(),
      ]);
      discoveredRooms = await this.service.activeRooms();
      await this.readiness.markReady();
      this.ready = true;
    } catch (error) {
      this.ready = false;
      await this.readiness.clearReady();
      await Promise.allSettled(
        [...this.sessions].map(([roomId, session]) => this.close(roomId, session, false)),
      );
      throw error;
    }
    const now = new Date();
    const active = new Map(discoveredRooms.map((room) => [room.id, room]));
    for (const [roomId, session] of this.sessions) {
      if (!active.has(roomId) || session.endsAt <= now) {
        await this.close(roomId, session);
        continue;
      }
      if (!(await this.coordinator.renewRoom(roomId, session.fencingToken))) {
        await this.close(roomId, session, false);
      }
    }
    for (const room of active.values()) {
      if (this.sessions.has(room.id)) continue;
      const lease = await this.coordinator.acquireRoom(room.id);
      if (!lease) continue;
      try {
        const session: ActiveSession = {
          fencingToken: lease.fencingToken,
          endsAt: room.endsAt,
          buffers: new Map(),
          media: undefined as unknown as RoomMediaSession,
        };
        session.media = await this.mediaSource.connect({
          roomId: room.id,
          onFrame: (frame) => this.buffer(room.id, session, frame.participantIdentity, frame.audio),
          onParticipantInactive: (identity) => {
            this.clearParticipantBuffer(session, identity);
            void this.service.cancelParticipant(room.id, identity);
          },
          onFailure: (category) => {
            void this.service.degrade(room.id, 'MEDIA_SUBSCRIPTION', category);
          },
        });
        this.sessions.set(room.id, session);
        await this.service.recoverIncident({
          roomId: room.id,
          component: 'MEDIA_SUBSCRIPTION',
          errorCategory: 'MEDIA_UNAVAILABLE',
          now,
        });
      } catch {
        await this.coordinator.releaseRoom(room.id, lease.fencingToken);
        await this.service.degrade(room.id, 'MEDIA_SUBSCRIPTION', 'MEDIA_UNAVAILABLE');
      }
    }
    await this.flushExpired();
    await this.service.deliverPending();
    await this.service.reconcileFinalization();
    if (Date.now() - this.lastMaintenanceAt >= 3_600_000) {
      await this.service.maintenance();
      this.lastMaintenanceAt = Date.now();
    }
  }

  private buffer(
    roomId: string,
    session: ActiveSession,
    participantIdentity: string,
    frame: Uint8Array,
  ) {
    if (this.isSilent(frame)) {
      const current = session.buffers.get(participantIdentity);
      frame.fill(0);
      if (
        current &&
        Date.now() - current.lastVoiceAt >=
          this.config.get('ROOM_SPEECH_SILENCE_MS', { infer: true })
      )
        this.flush(roomId, session, participantIdentity);
      return;
    }
    const maxBytes = this.config.get('ROOM_SPEECH_MAX_BUFFER_BYTES', { infer: true });
    const maxRoomBytes = this.config.get('ROOM_SPEECH_MAX_ROOM_BUFFER_BYTES', { infer: true });
    const totalRoomBytes = [...session.buffers.values()].reduce(
      (total, buffer) => total + buffer.bytes,
      0,
    );
    if (totalRoomBytes + frame.byteLength > maxRoomBytes) {
      const oldest = [...session.buffers.entries()].sort(
        ([, left], [, right]) => left.startedAt - right.startedAt,
      )[0];
      if (oldest) this.clearParticipantBuffer(session, oldest[0]);
      frame.fill(0);
      void this.service.degrade(roomId, 'MEDIA_SUBSCRIPTION', 'ROOM_BACKPRESSURE_DROP');
      return;
    }
    const observedAt = Date.now();
    const current = session.buffers.get(participantIdentity) ?? {
      chunks: [],
      bytes: 0,
      startedAt: observedAt,
      lastVoiceAt: observedAt,
    };
    if (current.bytes + frame.byteLength > maxBytes) {
      for (const chunk of current.chunks) chunk.fill(0);
      session.buffers.delete(participantIdentity);
      frame.fill(0);
      void this.service.degrade(roomId, 'MEDIA_SUBSCRIPTION', 'BACKPRESSURE_DROP');
      return;
    }
    current.chunks.push(frame);
    current.bytes += frame.byteLength;
    current.lastVoiceAt = observedAt;
    session.buffers.set(participantIdentity, current);
    if (Date.now() - current.startedAt >= this.config.get('ROOM_SPEECH_WINDOW_MS', { infer: true }))
      this.flush(roomId, session, participantIdentity);
  }

  private async flushExpired() {
    const threshold = this.config.get('ROOM_SPEECH_WINDOW_MS', { infer: true });
    for (const [roomId, session] of this.sessions)
      for (const [identity, buffer] of session.buffers)
        if (Date.now() - buffer.startedAt >= threshold) this.flush(roomId, session, identity);
  }

  private flush(roomId: string, session: ActiveSession, participantIdentity: string) {
    const buffer = session.buffers.get(participantIdentity);
    if (!buffer?.bytes) return;
    session.buffers.delete(participantIdentity);
    const audio = new Uint8Array(buffer.bytes);
    let offset = 0;
    for (const chunk of buffer.chunks) {
      audio.set(chunk, offset);
      offset += chunk.byteLength;
      chunk.fill(0);
    }
    const processing = this.service
      .processWindow({
        roomId,
        participantIdentity,
        audio,
        mimeType: 'audio/pcm',
        fencingToken: session.fencingToken,
      })
      .catch(() => audio.fill(0))
      .finally(() => this.pendingWindows.delete(processing));
    this.pendingWindows.add(processing);
  }

  private clearParticipantBuffer(session: ActiveSession, participantIdentity: string) {
    const buffer = session.buffers.get(participantIdentity);
    if (!buffer) return;
    for (const chunk of buffer.chunks) chunk.fill(0);
    session.buffers.delete(participantIdentity);
  }

  private isSilent(frame: Uint8Array): boolean {
    if (frame.byteLength < 2) return true;
    const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    for (let offset = 0; offset + 1 < frame.byteLength; offset += 2)
      if (Math.abs(view.getInt16(offset, true)) > 128) return false;
    return true;
  }

  private async close(roomId: string, session: ActiveSession, release = true) {
    this.sessions.delete(roomId);
    for (const buffer of session.buffers.values()) for (const chunk of buffer.chunks) chunk.fill(0);
    session.buffers.clear();
    await this.service.cancelRoom(roomId);
    await session.media.close();
    if (release) await this.coordinator.releaseRoom(roomId, session.fencingToken);
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
    this.ready = false;
    await this.readiness.clearReady();
    await Promise.allSettled(
      [...this.sessions].map(([roomId, session]) => this.close(roomId, session)),
    );
    await Promise.allSettled([...this.pendingWindows]);
  }
}
