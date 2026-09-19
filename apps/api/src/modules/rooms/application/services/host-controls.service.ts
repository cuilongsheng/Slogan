import { roomLifecycle } from '../../domain/policies/room-lifecycle.js';
import { Inject, Injectable } from '@nestjs/common';
import { RoomError } from '../../domain/errors/room.error.js';
import {
  ROOM_REALTIME_REPOSITORY,
  type LockedRealtimeRoom,
  type RealtimeMember,
  type RoomRealtimeRepository,
} from '../../domain/ports/room-realtime.repository.js';
import { RoomsService } from './rooms.service.js';
import { RoomRealtimeService } from './room-realtime.service.js';

export interface HostAction {
  kind: 'leave' | 'remove' | 'invite' | 'end';
  targetId?: string;
  expectedCredentialVersion?: number;
  successorMembershipId?: string;
}
export const ROOM_COMMAND_DELIVERY = Symbol('ROOM_COMMAND_DELIVERY');
export interface RoomCommandDelivery {
  dispatchPending(roomId: string): Promise<void>;
  scheduleExpiry(roomId: string, endsAt: Date): Promise<void>;
}

@Injectable()
export class HostControlsService {
  constructor(
    @Inject(ROOM_REALTIME_REPOSITORY) private readonly repository: RoomRealtimeRepository,
    private readonly rooms: RoomsService,
    private readonly realtime: RoomRealtimeService,
  ) {}

  async execute(roomId: string, userId: string, action: HostAction) {
    const result = await this.repository.withRoom(roomId, async (ctx) => {
      try {
        await roomLifecycle.settleAppointment(ctx);
        await this.rooms.assertEligible(userId, ctx.now);
        const actor = ctx.members.find((m) => m.userId === userId);
        if (actor && !actor.accountActive)
          throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Account is restricted');
        const host =
          actor?.lifecycle === 'ACTIVE' && actor.role === 'HOST' && ctx.room.hostUserId === userId;
        if (!actor) throw new RoomError('ROOM_MEMBERSHIP_REQUIRED', 'Room membership is required');
        if (action.kind !== 'leave' && !host)
          throw new RoomError('ROOM_HOST_REQUIRED', 'Current host permission is required');
        if (action.kind === 'end' && ctx.room.status !== 'OPEN') return this.result(ctx, actor);
        if (ctx.room.status !== 'OPEN' || ctx.room.endsAt <= ctx.now) {
          if (ctx.room.status === 'OPEN') await this.realtime.endLocked(ctx, 'EXPIRED');
          throw new RoomError('ROOM_ENDED', 'The room has ended');
        }
        const target =
          action.kind === 'leave' || action.kind === 'end'
            ? actor
            : ctx.members.find((m) => m.id === action.targetId);
        if (!target)
          throw new RoomError('ROOM_MEMBER_NOT_ACTIVE', 'Target is not a member of this room');
        if (action.kind === 'end') {
          await this.realtime.endLocked(ctx, 'HOST_ENDED', userId);
          return this.result(ctx, target);
        }
        if (action.kind !== 'leave' && target.id === actor.id)
          throw new RoomError('ROOM_OPERATION_CONFLICT', 'Use leave to exit as host');
        if (action.kind === 'leave' && action.successorMembershipId && !host)
          throw new RoomError(
            'ROOM_SUCCESSOR_INVALID',
            'Only the current host can select a successor',
          );
        const desired =
          action.kind === 'leave' ? 'LEFT' : action.kind === 'remove' ? 'REMOVED' : 'INVITED';
        // A completed generation can be retried, but must never affect a later rejoin.
        if (
          target.lifecycle === desired &&
          target.credentialVersion === (action.expectedCredentialVersion ?? -2) + 1
        )
          return this.result(ctx, target);
        if (target.credentialVersion !== action.expectedCredentialVersion)
          throw new RoomError('ROOM_OPERATION_CONFLICT', 'Membership generation changed');
        if (action.kind === 'invite') {
          if (target.lifecycle !== 'REMOVED')
            throw new RoomError('ROOM_OPERATION_CONFLICT', 'Only removed members can be invited');
          if (!target.accountActive)
            throw new RoomError('ROOM_ACCOUNT_RESTRICTED', 'Target account is restricted');
          await this.rooms.assertEligible(target.userId, ctx.now);
          if (ctx.room.hostReconnectDeadline)
            throw new RoomError('ROOM_HOST_RECONNECTING', 'Host reconnection is pending', {
              retryAt: ctx.room.hostReconnectDeadline.toISOString(),
            });
          if (
            new Set([
              ...ctx.members.filter((m) => m.lifecycle === 'ACTIVE').map((m) => m.userId),
              ...(ctx.reservedUserIds ?? []),
            ]).size >= ctx.room.capacity
          )
            throw new RoomError('ROOM_FULL', 'Room is full');
        } else if (target.lifecycle !== 'ACTIVE')
          throw new RoomError('ROOM_MEMBER_NOT_ACTIVE', 'An active membership is required');
        let successor: RealtimeMember | undefined;
        if (action.kind === 'leave' && host) {
          const candidates = ctx.members.filter(
            (m) =>
              m.id !== actor.id &&
              m.lifecycle === 'ACTIVE' &&
              m.accountActive &&
              m.presence === 'CONNECTED',
          );
          successor = action.successorMembershipId
            ? candidates.find((m) => m.id === action.successorMembershipId)
            : candidates[0];
          if (action.successorMembershipId && !successor)
            throw new RoomError(
              'ROOM_SUCCESSOR_INVALID',
              'Successor must be an online active member',
            );
        }
        await ctx.saveRoom({ stateVersion: ctx.room.stateVersion + 1 });
        if (action.kind === 'leave' && host) {
          if (successor)
            await this.realtime.transferLocked(ctx, actor, successor, 'HOST_LEFT', userId);
          else await this.realtime.endLocked(ctx, 'NO_SUCCESSOR', userId);
        }
        await ctx.saveMember(target.id, {
          lifecycle: desired,
          credentialVersion: target.credentialVersion + 1,
          ...(action.kind === 'leave' ? { leftAt: ctx.now, role: 'MEMBER' as const } : {}),
          ...(action.kind === 'remove'
            ? { removedAt: ctx.now, removalReason: 'HOST_REMOVED' }
            : {}),
          ...(action.kind !== 'invite' ? { presence: 'DISCONNECTED' as const } : {}),
        });
        if (action.kind !== 'invite') {
          // Only identities that were issued need provider revocation.
          for (const identity of ctx.identities.filter(
            (i) => i.membershipId === target.id && !i.revokedAt,
          ))
            await ctx.enqueue('REVOKE_IDENTITY', identity.identity);
        }
        await roomLifecycle.settleAppointment(ctx);
        await ctx.appendEvent({
          type: `member_${action.kind}`,
          source: 'http',
          actorId: userId,
          targetId: target.id,
          reason: desired,
          result: 'COMMITTED',
          occurredAt: ctx.now,
        });
        return this.result(ctx, target);
      } catch (error) {
        if (!(error instanceof RoomError)) throw error;
        await ctx.appendEvent({
          type: `rejected_${action.kind}`,
          source: 'http',
          actorId: userId,
          ...(action.targetId ? { targetId: action.targetId } : {}),
          reason: error.code,
          result: 'DENIED',
          occurredAt: ctx.now,
        });
        return error;
      }
    });
    if (!result) throw new RoomError('ROOM_NOT_FOUND', 'Room not found');
    if (result instanceof RoomError) throw result;
    return result;
  }
  private result(ctx: LockedRealtimeRoom, member: RealtimeMember) {
    return {
      roomId: ctx.room.id,
      roomStatus: ctx.room.status,
      hostUserId: ctx.room.hostUserId,
      membershipId: member.id,
      lifecycle: member.lifecycle,
      credentialVersion: member.credentialVersion,
    };
  }
  async deliveryStatus(roomId: string) {
    return this.realtime.operationStatus(roomId);
  }
}
