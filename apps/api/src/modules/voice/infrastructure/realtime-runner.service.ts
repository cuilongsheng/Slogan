import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { RealtimeQueue } from '../../../infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import { RoomRealtimeService } from '../../rooms/index.js';
import { VoiceService } from '../application/services/voice.service.js';

@Injectable()
export class RealtimeRunner implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running: Promise<void> | undefined;
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly queue: RealtimeQueue,
    private readonly rooms: RoomRealtimeService,
    private readonly voice: VoiceService,
    private readonly logger: StructuredLogger,
  ) {}
  async onModuleInit() {
    await this.queue.start(async (job) => {
      if (job.kind === 'appointment-open' || job.kind === 'appointment-start-window') {
        await this.rooms.settleAppointment(job.id);
        return;
      }
      if (!this.config.get('REALTIME_ENABLED', { infer: true })) return;
      if (job.kind === 'expiry') await this.voice.expire(job.id);
      else await this.voice.dispatch(job.id);
    });
    this.tick();
    this.timer = setInterval(() => this.tick(), 15_000);
    this.timer.unref();
  }
  private tick() {
    if (this.running) return;
    this.running = this.recover()
      .catch(() => this.logger.warn('realtime_recovery_unavailable'))
      .finally(() => {
        this.running = undefined;
      });
  }
  async recover() {
    const mediaEnabled = this.config.get('REALTIME_ENABLED', { infer: true });
    for (const room of await this.rooms.recoverableRooms()) {
      if (room.kind !== 'APPOINTMENT') continue;
      try {
        await this.rooms.settleAppointment(room.id);
        if (room.startedAt! > new Date())
          await this.queue.enqueue({ kind: 'appointment-open', id: room.id }, room.startedAt!);
        if (room.initialHostDeadline! > new Date())
          await this.queue.enqueue(
            { kind: 'appointment-start-window', id: room.id },
            room.initialHostDeadline!,
          );
      } catch {
        this.logger.warn({ event: 'appointment_recovery_pending', roomId: room.id });
      }
    }
    if (!mediaEnabled) return;
    for (const timer of await this.rooms.scheduledHostTimeouts()) {
      try {
        await this.queue.enqueue({ kind: 'host-timeout', id: timer.id }, timer.runAt);
      } catch {
        this.logger.warn('host_timeout_scheduling_pending');
      }
    }
    for (const room of await this.rooms.recoverableRooms()) {
      try {
        if (room.status === 'OPEN') {
          if (room.endsAt <= new Date()) await this.voice.expire(room.id);
          else {
            await this.queue.enqueue({ kind: 'expiry', id: room.id }, room.endsAt);
            await this.voice.reconcile(room.id);
          }
        }
      } catch {
        this.logger.warn({ event: 'realtime_room_recovery_pending', roomId: room.id });
      }
    }
    for (const id of await this.rooms.pendingCommands()) {
      try {
        await this.queue.enqueue({ kind: 'command', id });
      } catch {
        this.logger.warn('realtime_command_scheduling_pending');
      }
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
