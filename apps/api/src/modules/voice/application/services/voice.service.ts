import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Environment } from '../../../../config/environment.js';
import { RoomRealtimeService } from '../../../rooms/index.js';
import {
  REALTIME_PROVIDER,
  type RealtimeProvider,
} from '../../domain/ports/realtime-provider.port.js';
import { RealtimeError } from '../../domain/errors/realtime.error.js';
import { serializeRoomTimeMetadata } from '../../domain/room-time-metadata.js';
import { RealtimeQueue } from '../../../../infrastructure/redis/realtime-queue.service.js';

@Injectable()
export class VoiceService {
  private readonly reconciled = new Map<string, string>();
  constructor(
    private readonly rooms: RoomRealtimeService,
    @Inject(REALTIME_PROVIDER) private readonly provider: RealtimeProvider,
    private readonly config: ConfigService<Environment, true>,
    private readonly queue?: RealtimeQueue,
  ) {}
  async credentials(roomId: string, userId: string) {
    this.assertEnabled();
    const reservation = await this.rooms.reserveCredential(roomId, userId);
    let providerStarted = false;
    let providerCompleted = false;
    try {
      // Sign before network I/O; ending waits for bounded in-flight issuance leases before revocation.
      const issued = await this.provider.token(
        roomId,
        reservation.identity,
        this.config.get('LIVEKIT_TOKEN_TTL_SECONDS', { infer: true }),
      );
      if (Date.now() + 15_000 >= reservation.issueUntil.getTime())
        throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
      providerStarted = true;
      const roomSid = await this.provider.ensureRoom(
        roomId,
        reservation.capacity,
        serializeRoomTimeMetadata(reservation),
      );
      providerCompleted = true;
      const authorization = await this.rooms.confirmCredential(reservation, userId, roomSid);
      return {
        ...authorization,
        roomId,
        serverUrl: this.config.get('LIVEKIT_URL', { infer: true })!,
        participantToken: issued.token,
        expiresAt: issued.expiresAt.toISOString(),
        participantIdentity: reservation.identity,
      };
    } finally {
      if (!providerStarted || providerCompleted) {
        await this.rooms.finishCredential(reservation.issuanceId);
        // Durable recovery dispatches cleanup; issuing a valid credential must not await it.
      }
    }
  }

  members(roomId: string, userId: string) {
    this.assertEnabled();
    return this.rooms.members(roomId, userId);
  }
  removedMembers(roomId: string, userId: string) {
    this.assertEnabled();
    return this.rooms.removedMembers(roomId, userId);
  }
  async webhook(body: string, authorization: string) {
    this.assertEnabled();
    const event = await this.provider.verifyWebhook(body, authorization);
    if (!event) return;
    const match = /^room-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
      event.roomName,
    );
    if (!match) return;
    await this.rooms.applySignal({ ...event, roomId: match[1]! });
    await this.dispatchPending(match[1]!);
  }
  async dispatch(id: string) {
    const command = await this.rooms.claimCommand(id);
    if (!command) return;
    try {
      if (command.type === 'HOST_TIMEOUT') await this.rooms.hostTimeout(command);
      else if (command.type === 'REVOKE_IDENTITY' && command.identity)
        await this.provider.revoke(command.roomId, command.identity);
      else if (command.type === 'DELETE_ROOM') await this.provider.deleteRoom(command.roomId);
      else if (command.type === 'SYNC_ROOM_TIME') await this.syncRoomTime(command.roomId);
      await this.rooms.completeCommand(command);
    } catch {
      await this.rooms.failCommand(command);
      throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
    }
  }
  async dispatchPending(roomId?: string) {
    const ids = await this.rooms.pendingCommands(roomId);
    for (const id of ids) {
      try {
        await this.dispatch(id);
      } catch {
        /* Persistent command retry owns provider failure. */
      }
    }
  }
  async expire(roomId: string) {
    await this.rooms.endRoom(roomId, 'EXPIRED', true);
    await this.dispatchPending(roomId);
  }
  async scheduleExpiry(roomId: string, endsAt: Date) {
    try {
      await this.queue?.enqueue({ kind: 'expiry', id: roomId }, endsAt);
    } catch {
      // PostgreSQL remains authoritative; recovery will schedule the current endsAt.
    }
  }
  async reconcile(roomId: string) {
    const head = await this.rooms.reconciliationHead?.(roomId);
    if (head && head.status !== 'OPEN') return;
    if (head && head.endsAt <= new Date()) {
      await this.expire(roomId);
      return;
    }
    if (head && !head.providerRoomSid) return;
    // Provider observations are the only reason to refresh an unchanged durable snapshot.
    const earlyRemote = head ? await this.provider.participants(roomId) : undefined;
    const fingerprint =
      head && earlyRemote
        ? `${head.version}:${earlyRemote.roomSid}:${JSON.stringify(earlyRemote.participants.map((p) => [p.identity, p.sessionSid]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))}`
        : undefined;
    if (fingerprint && this.reconciled.get(roomId) === fingerprint) return;
    const snapshot = await this.rooms.snapshot(roomId);
    if (!snapshot || snapshot.room.status !== 'OPEN') return;
    if (snapshot.room.endsAt <= new Date()) {
      await this.expire(roomId);
      return;
    }
    if (!snapshot.room.providerRoomSid) return;
    if (head && head.providerRoomSid !== snapshot.room.providerRoomSid) return;
    const observedAt = head?.observedAt ?? snapshot.observedAt;
    const remote = earlyRemote ?? (await this.provider.participants(roomId));
    if (!remote.roomSid || remote.roomSid !== snapshot.room.providerRoomSid) {
      await this.rooms.applySignal({
        id: randomUUID(),
        roomId,
        roomSid: snapshot.room.providerRoomSid,
        type: 'finished',
        occurredAt: observedAt,
        source: 'reconciliation',
      });
      return;
    }
    for (const member of snapshot.members) {
      const found = remote.participants.find((p) => p.identity === member.participantIdentity);
      if (
        (found &&
          (member.presence !== 'CONNECTED' || member.providerSessionSid !== found.sessionSid)) ||
        (!found && member.presence === 'CONNECTED')
      ) {
        await this.rooms.applySignal({
          id: randomUUID(),
          roomId,
          roomSid: remote.roomSid,
          type: found ? 'joined' : 'left',
          identity: member.participantIdentity,
          sessionSid: found?.sessionSid ?? member.providerSessionSid ?? undefined,
          occurredAt: observedAt,
          source: 'reconciliation',
        });
      }
    }
    for (const participant of remote.participants) {
      if (
        !snapshot.members.some(
          (m) =>
            m.participantIdentity === participant.identity &&
            m.accountActive &&
            m.lifecycle === 'ACTIVE',
        )
      )
        await this.provider.revoke(roomId, participant.identity);
    }
    if (fingerprint) {
      if (this.reconciled.size >= 128) this.reconciled.delete(this.reconciled.keys().next().value!);
      this.reconciled.set(roomId, fingerprint);
    }
  }
  private assertEnabled() {
    if (!this.config.get('REALTIME_ENABLED', { infer: true }))
      throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
  }

  private async syncRoomTime(roomId: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const before = await this.rooms.snapshot(roomId);
      if (!before || !before.room.providerRoomSid) return;
      const result = await this.provider.updateRoomMetadata(
        roomId,
        serializeRoomTimeMetadata(before.room),
      );
      if (result === 'NOT_FOUND') return;
      const after = await this.rooms.snapshot(roomId);
      if (!after || after.room.stateVersion === before.room.stateVersion) return;
    }
    throw new RealtimeError('REALTIME_PROVIDER_UNAVAILABLE');
  }
}
