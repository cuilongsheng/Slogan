import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/environment.js';

@Injectable()
export class ObservabilityHeartbeat {
  private readonly lastAttempt = new Map<string, number>();
  constructor(private readonly config: ConfigService<Environment, true>) {}
  async completed(
    kind: 'monitor' | 'realtime' | 'auth-mail' | 'operations' | 'room-speech',
  ): Promise<void> {
    const flags = {
      monitor: 'OBSERVABILITY_MONITOR_ENABLED',
      'auth-mail': 'EMAIL_PASSWORD_AUTH_ENABLED',
      operations: 'OPERATIONS_GOVERNANCE_ENABLED',
      'room-speech': 'ROOM_SPEECH_DETECTION_ENABLED',
    } as const;
    if (kind !== 'realtime' && !this.config.get(flags[kind], { infer: true })) return;
    const keys = {
      monitor: 'OBSERVABILITY_MONITOR_HEARTBEAT_URL',
      realtime: 'OBSERVABILITY_REALTIME_HEARTBEAT_URL',
      'auth-mail': 'OBSERVABILITY_AUTH_MAIL_HEARTBEAT_URL',
      operations: 'OBSERVABILITY_OPERATIONS_HEARTBEAT_URL',
      'room-speech': 'OBSERVABILITY_ROOM_SPEECH_HEARTBEAT_URL',
    } as const;
    const url = this.config.get(keys[kind], { infer: true });
    if (!url) return;
    const now = Date.now();
    if (now - (this.lastAttempt.get(kind) ?? 0) < 60_000) return;
    this.lastAttempt.set(kind, now);
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: '',
        signal: AbortSignal.timeout(
          this.config.get('OBSERVABILITY_HEARTBEAT_TIMEOUT_MS', { infer: true }),
        ),
      });
      await response.body?.cancel();
    } catch {
      /* External monitor detects missing completion; never retry business. */
    }
  }
}
