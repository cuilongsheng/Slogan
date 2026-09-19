import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/index.js';
import {
  hasBackofficePermission,
  sortBackofficeRoles,
  type BackofficeRole,
} from '../../backoffice/index.js';
import { loadLockedRealtimeRoom, roomLifecycle } from '../../rooms/index.js';
import type { AccountDeletionResult } from '../domain/entities/account-lifecycle.js';
import { AccountLifecycleError } from '../domain/errors/account-lifecycle.error.js';
import type { AccountLifecycleRepository } from '../domain/ports/account-lifecycle.repository.js';

@Injectable()
export class PrismaAccountLifecycleRepository implements AccountLifecycleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDeletionCommand(
    userId: string,
    clientRequestId: string,
    payloadHash: string,
  ): Promise<AccountDeletionResult | null> {
    const command = await this.prisma.accountLifecycleCommand.findUnique({
      where: { userId_clientRequestId: { userId, clientRequestId } },
    });
    if (!command) return null;
    if (command.payloadHash !== payloadHash) {
      throw new AccountLifecycleError(
        'ACCOUNT_DELETE_REQUEST_CONFLICT',
        'Account deletion request conflicts with an earlier request',
      );
    }
    return { userId, status: 'DELETED', deletedAt: command.deletedAt };
  }

  async deleteAccount(input: {
    userId: string;
    clientRequestId: string;
    payloadHash: string;
    now: Date;
  }): Promise<AccountDeletionResult> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => this.deleteLocked(tx, input), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!this.retryable(error) || attempt === 2) throw error;
      }
    }
    throw new AccountLifecycleError(
      'ACCOUNT_DELETE_UNAVAILABLE',
      'Account deletion is unavailable',
    );
  }

  async restrictedRecord(input: {
    actorUserId: string;
    targetUserId: string;
    requestId?: string;
    now: Date;
  }) {
    const outcome = await this.prisma.$transaction(async (tx) => {
      const roleRows = await tx.backofficeRoleAssignment.findMany({
        where: { userId: input.actorUserId, revokedAt: null, user: { status: 'ACTIVE' } },
        select: { role: true },
      });
      const roles = sortBackofficeRoles(roleRows.map((row) => row.role as BackofficeRole));
      const allowed = hasBackofficePermission(roles, 'ACCOUNT_RESTRICTED_RECORD_READ');
      const target = allowed
        ? await tx.user.findUnique({
            where: { id: input.targetUserId },
            include: {
              phoneIdentity: true,
              identities: true,
              profile: true,
              safetyCasesReceived: {
                include: { restriction: { include: { appeal: true } } },
              },
            },
          })
        : null;
      if (!allowed || target?.status !== 'DELETED' || !target.deletedAt) {
        await appendBackofficeAuditEvent(tx, {
          actorType: 'USER',
          actorUserId: input.actorUserId,
          actorRoles: roles,
          action: 'ACCOUNT_RESTRICTED_RECORD_REJECTED',
          targetType: 'USER',
          targetId: input.targetUserId,
          reason: allowed ? 'NOT_FOUND' : 'PERMISSION_DENIED',
          result: 'REJECTED',
          ...(input.requestId ? { requestId: input.requestId } : {}),
        });
        return {
          error: allowed
            ? ('RESTRICTED_ACCOUNT_RECORD_NOT_FOUND' as const)
            : ('RESTRICTED_ACCOUNT_RECORD_DENIED' as const),
        };
      }
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: roles,
        action: 'ACCOUNT_RESTRICTED_RECORD_VIEWED',
        targetType: 'USER',
        targetId: input.targetUserId,
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
      });
      const restrictions = target.safetyCasesReceived.flatMap((item) =>
        item.restriction ? [item.restriction] : [],
      );
      return {
        record: {
          userId: target.id,
          status: 'DELETED' as const,
          createdAt: target.createdAt,
          deletedAt: target.deletedAt,
          loginMethods: [
            ...(target.phoneIdentity ? (['PHONE'] as const) : []),
            ...target.identities.map((item) => item.provider),
          ],
          profile: target.profile
            ? {
                displayName: target.profile.displayName,
                avatarUrl: target.profile.avatarUrl,
                nationalityCode: target.profile.nationalityCode,
                cefrLevel: target.profile.cefrLevel,
              }
            : null,
          safetyCaseIds: target.safetyCasesReceived.map((item) => item.id),
          restrictionIds: restrictions.map((item) => item.id),
          appealIds: restrictions.flatMap((item) => (item.appeal ? [item.appeal.id] : [])),
        },
      };
    });
    if ('error' in outcome) {
      throw new AccountLifecycleError(outcome.error, 'Restricted account record is unavailable');
    }
    return outcome.record;
  }

  purgeCommands(before: Date): Promise<number> {
    return this.prisma.accountLifecycleCommand
      .deleteMany({ where: { createdAt: { lt: before } } })
      .then((result) => result.count);
  }

  private async deleteLocked(
    tx: Prisma.TransactionClient,
    input: { userId: string; clientRequestId: string; payloadHash: string; now: Date },
  ): Promise<AccountDeletionResult> {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId}::uuid FOR UPDATE`;
    const existing = await tx.accountLifecycleCommand.findUnique({
      where: {
        userId_clientRequestId: { userId: input.userId, clientRequestId: input.clientRequestId },
      },
    });
    if (existing) {
      if (existing.payloadHash !== input.payloadHash) {
        throw new AccountLifecycleError(
          'ACCOUNT_DELETE_REQUEST_CONFLICT',
          'Account deletion request conflicts with an earlier request',
        );
      }
      return { userId: input.userId, status: 'DELETED', deletedAt: existing.deletedAt };
    }
    const user = await tx.user.findUnique({ where: { id: input.userId } });
    if (user?.status !== 'ACTIVE') {
      throw new AccountLifecycleError(
        'ACCOUNT_DELETE_UNAVAILABLE',
        'Account deletion is unavailable',
      );
    }
    if (
      (await tx.backofficeRoleAssignment.count({
        where: { userId: input.userId, revokedAt: null },
      })) > 0
    ) {
      throw new AccountLifecycleError(
        'ACCOUNT_DELETE_ROLE_ACTIVE',
        'Active backoffice roles must be revoked before account deletion',
      );
    }

    const hosted = await tx.room.findMany({
      where: { hostUserId: input.userId, status: { in: ['OPEN', 'SCHEDULED'] } },
      select: { id: true, status: true },
    });
    await tx.user.update({
      where: { id: input.userId },
      data: { status: 'DELETED', deletedAt: input.now, updatedAt: input.now },
    });
    await tx.authSession.updateMany({
      where: { userId: input.userId, revokedAt: null },
      data: { revokedAt: input.now, updatedAt: input.now },
    });

    for (const room of hosted) {
      if (room.status === 'SCHEDULED') {
        await tx.room.update({
          where: { id: room.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: input.now,
            cancelledReason: 'HOST_ACCOUNT_DELETED',
            stateVersion: { increment: 1 },
          },
        });
        await tx.roomReservation.updateMany({
          where: { roomId: room.id, status: 'BOOKED' },
          data: { status: 'CANCELLED', cancelledAt: input.now, version: { increment: 1 } },
        });
        continue;
      }
      const context = await loadLockedRealtimeRoom(tx, room.id);
      const previous = context.members.find((member) => member.userId === input.userId);
      const successor = context.members.find(
        (member) =>
          member.userId !== input.userId &&
          member.lifecycle === 'ACTIVE' &&
          member.accountActive &&
          member.presence === 'CONNECTED',
      );
      if (successor) {
        await roomLifecycle.transferLocked(
          context,
          previous,
          successor,
          'HOST_ACCOUNT_DELETED',
          input.userId,
        );
      } else {
        await roomLifecycle.endLocked(context, 'HOST_ACCOUNT_DELETED', input.userId);
      }
    }

    const memberships = await tx.roomMembership.findMany({
      where: { userId: input.userId },
      include: { realtimeIdentities: { where: { revokedAt: null } } },
    });
    for (const membership of memberships) {
      const room = await tx.room.findUniqueOrThrow({ where: { id: membership.roomId } });
      for (const identity of membership.realtimeIdentities) {
        await tx.realtimeCommand.upsert({
          where: { key: `REVOKE_IDENTITY-${room.id}-${identity.identity}-account-delete` },
          create: {
            key: `REVOKE_IDENTITY-${room.id}-${identity.identity}-account-delete`,
            roomId: room.id,
            type: 'REVOKE_IDENTITY',
            identity: identity.identity,
            stateVersion: room.stateVersion,
          },
          update: {},
        });
      }
      const identities = membership.realtimeIdentities.map((identity) => identity.identity);
      if (identities.length) {
        await tx.realtimeIdentity.updateMany({
          where: { identity: { in: identities }, revokedAt: null },
          data: { revokedAt: input.now },
        });
        await tx.realtimeIssuance.deleteMany({ where: { identity: { in: identities } } });
      }
      if (membership.lifecycle === 'ACTIVE') {
        await tx.roomMembership.update({
          where: { id: membership.id },
          data: {
            lifecycle: 'LEFT',
            leftAt: input.now,
            role: 'MEMBER',
            presence: 'DISCONNECTED',
            credentialVersion: { increment: 1 },
          },
        });
      }
    }

    await tx.roomReservation.updateMany({
      where: { userId: input.userId, status: 'BOOKED' },
      data: { status: 'CANCELLED', cancelledAt: input.now, version: { increment: 1 } },
    });
    await tx.roomInvitation.updateMany({
      where: {
        status: 'PENDING',
        OR: [{ inviterUserId: input.userId }, { inviteeUserId: input.userId }],
      },
      data: { status: 'CANCELLED', resolvedAt: input.now },
    });
    await tx.friendRequest.updateMany({
      where: { requesterUserId: input.userId, status: 'PENDING' },
      data: { status: 'WITHDRAWN', resolvedAt: input.now },
    });
    await tx.friendRequest.updateMany({
      where: { recipientUserId: input.userId, status: 'PENDING' },
      data: { status: 'REJECTED', resolvedAt: input.now },
    });
    await tx.friendship.updateMany({
      where: {
        endedAt: null,
        OR: [{ userLowId: input.userId }, { userHighId: input.userId }],
      },
      data: { endedAt: input.now, endedByUserId: input.userId },
    });

    await appendBackofficeAuditEvent(tx, {
      actorType: 'USER',
      actorUserId: input.userId,
      actorRoles: [],
      action: 'ACCOUNT_DELETED',
      targetType: 'USER',
      targetId: input.userId,
      result: 'SUCCEEDED',
      clientRequestId: input.clientRequestId,
      requestHash: input.payloadHash,
    });
    await tx.accountLifecycleCommand.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        action: 'DELETE_ACCOUNT',
        status: 'COMPLETED',
        clientRequestId: input.clientRequestId,
        payloadHash: input.payloadHash,
        deletedAt: input.now,
        createdAt: input.now,
      },
    });
    return { userId: input.userId, status: 'DELETED', deletedAt: input.now };
  }

  private retryable(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    );
  }
}
