import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { AppError } from '../../../common/errors/app-error.js';
import { REALTIME_PROVIDER, type RealtimeProvider } from '../../voice/index.js';
import {
  DIRECT_REPOSITORY,
  type DirectRepository,
  type DirectPageQuery,
  type DirectTimelineQuery,
} from '../domain/direct.js';

@Injectable()
export class DirectService {
  constructor(
    @Inject(DIRECT_REPOSITORY) private readonly repository: DirectRepository,
    @Inject(REALTIME_PROVIDER) private readonly media: RealtimeProvider,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  timeline(actor: string, id: string, query: DirectTimelineQuery) {
    return this.repository.timeline(actor, id, query);
  }
  unreadCount(actor: string) {
    return this.repository.unreadCount(actor);
  }
  open(actor: string, target: string) {
    return this.repository.open(actor, target);
  }
  conversations(actor: string, query: DirectPageQuery) {
    return this.repository.conversations(actor, query);
  }
  detail(actor: string, id: string) {
    return this.repository.detail(actor, id);
  }
  messages(actor: string, id: string, query: DirectPageQuery) {
    return this.repository.messages(actor, id, query);
  }
  send(actor: string, id: string, text: string, requestId: string) {
    const canonical = text.trim();
    if (!canonical || Array.from(canonical).length > 2000)
      throw new AppError('DIRECT_TEXT_INVALID', 'Text must contain 1–2000 characters', 400);
    return this.repository.send(actor, id, canonical, requestId);
  }
  read(actor: string, id: string, sequence: number) {
    return this.repository.read(actor, id, sequence);
  }
  hide(actor: string, id: string, requestId: string) {
    return this.repository.hide(actor, id, requestId);
  }
  report(
    actor: string,
    id: string,
    messageId: string,
    category: string,
    description: string,
    requestId: string,
  ) {
    if (!description.trim())
      throw new AppError('DIRECT_REPORT_INVALID', 'Describe the report', 400);
    return this.repository.report(actor, id, messageId, category, description.trim(), requestId);
  }
  callHistory(actor: string, id: string, query: DirectPageQuery) {
    return this.repository.callHistory(actor, id, query);
  }
  requestCall(actor: string, id: string, requestId: string) {
    if (!this.config.get('REALTIME_ENABLED', { infer: true }))
      throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Voice is unavailable', 503);
    return this.repository.requestCall(actor, id, requestId);
  }
  call(actor: string, id: string) {
    return this.repository.call(actor, id);
  }
  calls(actor: string) {
    return this.repository.calls(actor);
  }
  actCall(actor: string, id: string, action: 'accept' | 'reject' | 'end', requestId: string) {
    return this.repository.actCall(actor, id, action, requestId);
  }
  heartbeat(actor: string, id: string) {
    return this.repository.heartbeat(actor, id);
  }
  async credentials(actor: string, id: string) {
    const call = await this.repository.heartbeat(actor, id);
    if (call.status !== 'ACTIVE')
      throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Call is unavailable', 409);
    const roomId = `direct-${id}`;
    const token = await this.media.token(roomId, `direct:${id}:${actor}`, 30);
    // Record the actual JWT expiry before provider I/O so cleanup knows when stale tokens expire.
    if (!(await this.repository.reserveCredentials(actor, id, token.expiresAt)))
      throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Call is unavailable', 409);
    try {
      await this.media.ensureRoom(roomId, 2, JSON.stringify({ kind: 'DIRECT_CALL', callId: id }));
    } catch (error) {
      // A timed-out provider request may still create a room after an end command.
      const latest = await this.repository.call(actor, id);
      if (latest.status !== 'ACTIVE') await this.repository.rescheduleCleanup(id);
      if (error instanceof AppError) throw error;
      throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Voice is temporarily unavailable', 503);
    }
    // Recheck after provider I/O. A concurrent end/block must never return a usable credential.
    const confirmed = await this.repository.call(actor, id);
    if (confirmed.status !== 'ACTIVE') {
      await this.repository.rescheduleCleanup(id);
      throw new AppError('DIRECT_CALL_UNAVAILABLE', 'Call is unavailable', 409);
    }
    return {
      url: this.config.get('LIVEKIT_URL', { infer: true }),
      token: token.token,
      expiresAt: token.expiresAt.toISOString(),
      identity: `direct:${id}:${actor}`,
      roomName: `room-${roomId}`,
    };
  }
  async maintain() {
    const commands = await this.repository.expireAndClaimCleanup();
    for (const command of commands) {
      let success = false;
      try {
        const roomId = `direct-${command.id}`;
        const revocations = await Promise.allSettled(
          [command.callerUserId, command.calleeUserId].map((user) =>
            this.media.revoke(roomId, `direct:${command.id}:${user}`),
          ),
        );
        // A missing participant is not revocation proof. Keep retrying until all issued tokens expire.
        const tokensExpired =
          !command.credentialExpiresAt ||
          command.credentialExpiresAt.getTime() + 2000 <= Date.now();
        if (tokensExpired || revocations.every((result) => result.status === 'fulfilled')) {
          await this.media.deleteRoom(roomId);
          success = tokensExpired;
        }
      } catch {
        /* Durable lease retry owns provider recovery. */
      }
      await this.repository.finishCleanup(command.id, command.leaseId, command.generation, success);
    }
    return { processed: commands.length };
  }
}
