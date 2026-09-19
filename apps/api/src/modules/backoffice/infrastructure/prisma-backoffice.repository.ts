import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/persistence.js';
import type {
  BackofficeRole,
  RoleAssignmentQuery,
  RoleAssignmentView,
  RoleMutationInput,
} from '../domain/entities/backoffice.js';
import { BackofficeError } from '../domain/errors/backoffice.error.js';
import type { BackofficeRepository } from '../domain/ports/backoffice.repository.js';
import {
  sortBackofficeRoles,
  wouldRemoveLastPlatformAdmin,
} from '../domain/policies/backoffice.policy.js';
import { lockPlatformAdminSet } from '../persistence.js';

const BOOTSTRAP_LOCK = 8_121_001;

type Cursor = { at: string; id: string };
function encodeCursor(value: Cursor): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function decodeCursor(value?: string): Cursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as Cursor;
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        parsed.id,
      ) ||
      Number.isNaN(Date.parse(parsed.at))
    )
      throw new Error();
    return parsed;
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Request validation failed', 400);
  }
}
function assignmentView(row: {
  id: string;
  userId: string;
  role: BackofficeRole;
  grantedAt: Date;
  revokedAt: Date | null;
  version: number;
}): RoleAssignmentView {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role,
    active: row.revokedAt === null,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    version: row.version,
  };
}

@Injectable()
export class PrismaBackofficeRepository implements BackofficeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async currentRoles(userId: string): Promise<BackofficeRole[]> {
    const rows = await this.prisma.backofficeRoleAssignment.findMany({
      where: { userId, revokedAt: null, user: { status: 'ACTIVE' } },
      select: { role: true },
    });
    return sortBackofficeRoles(rows.map((row) => row.role));
  }

  async bootstrap(userId: string): Promise<{ roles: BackofficeRole[]; created: boolean }> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK})`;
        const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
        if (!user || user.status !== 'ACTIVE') throw BackofficeError.userNotFound();
        const activeAdmins = await tx.backofficeRoleAssignment.findMany({
          where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
          select: { userId: true },
        });
        const target = await tx.backofficeRoleAssignment.findMany({
          where: { userId, role: { in: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'] }, revokedAt: null },
          select: { role: true },
        });
        if (activeAdmins.length > 0) {
          if (activeAdmins.every((row) => row.userId === userId) && target.length === 2)
            return { roles: sortBackofficeRoles(target.map((row) => row.role)), created: false };
          throw BackofficeError.conflict();
        }
        if (target.length !== 0) throw BackofficeError.conflict();
        await tx.backofficeRoleAssignment.createMany({
          data: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'].map((role) => ({
            id: randomUUID(),
            userId,
            role: role as BackofficeRole,
          })),
        });
        await appendBackofficeAuditEvent(tx, {
          actorType: 'SYSTEM_BOOTSTRAP',
          actorRoles: [],
          action: 'BACKOFFICE_BOOTSTRAPPED',
          targetType: 'USER',
          targetId: userId,
          result: 'SUCCEEDED',
          details: { roles: 'PLATFORM_ADMIN,SAFETY_OFFICER' },
        });
        return { roles: ['PLATFORM_ADMIN', 'SAFETY_OFFICER'], created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async mutateRole(input: RoleMutationInput): Promise<RoleAssignmentView> {
    const existing = await this.prisma.backofficeAuditEvent.findUnique({
      where: {
        actorUserId_clientRequestId: {
          actorUserId: input.actorUserId,
          clientRequestId: input.clientRequestId,
        },
      },
    });
    if (existing) return this.replay(input, existing);
    try {
      const outcome = await this.prisma.$transaction(
        async (tx) => {
          await lockPlatformAdminSet(tx);
          const actorRoles = await tx.backofficeRoleAssignment.findMany({
            where: { userId: input.actorUserId, revokedAt: null, user: { status: 'ACTIVE' } },
            select: { role: true },
          });
          const currentActorRoles = sortBackofficeRoles(actorRoles.map((row) => row.role));
          if (!currentActorRoles.includes('PLATFORM_ADMIN')) throw BackofficeError.denied();
          const prior = await tx.backofficeAuditEvent.findUnique({
            where: {
              actorUserId_clientRequestId: {
                actorUserId: input.actorUserId,
                clientRequestId: input.clientRequestId,
              },
            },
          });
          if (prior) return { replay: prior } as const;
          const target = await tx.user.findUnique({
            where: { id: input.targetUserId },
            select: { status: true },
          });
          if (!target || target.status !== 'ACTIVE') throw BackofficeError.userNotFound();
          let row = await tx.backofficeRoleAssignment.findUnique({
            where: { userId_role: { userId: input.targetUserId, role: input.role } },
          });
          if (
            input.action === 'REVOKE' &&
            input.role === 'PLATFORM_ADMIN' &&
            row?.revokedAt === null
          ) {
            const count = await tx.backofficeRoleAssignment.count({
              where: { role: 'PLATFORM_ADMIN', revokedAt: null, user: { status: 'ACTIVE' } },
            });
            if (wouldRemoveLastPlatformAdmin(count, true)) {
              await appendBackofficeAuditEvent(
                tx,
                this.mutationAudit(input, currentActorRoles, 'REJECTED'),
              );
              return { rejected: true } as const;
            }
          }
          const now = new Date();
          if (input.action === 'GRANT') {
            row = row
              ? await tx.backofficeRoleAssignment.update({
                  where: { id: row.id },
                  data: row.revokedAt
                    ? {
                        revokedAt: null,
                        revokedByUserId: null,
                        grantedAt: now,
                        grantedByUserId: input.actorUserId,
                        version: { increment: 1 },
                      }
                    : {},
                })
              : await tx.backofficeRoleAssignment.create({
                  data: {
                    id: randomUUID(),
                    userId: input.targetUserId,
                    role: input.role,
                    grantedByUserId: input.actorUserId,
                  },
                });
          } else if (row && row.revokedAt === null) {
            row = await tx.backofficeRoleAssignment.update({
              where: { id: row.id },
              data: {
                revokedAt: now,
                revokedByUserId: input.actorUserId,
                version: { increment: 1 },
              },
            });
          } else if (!row) {
            row = await tx.backofficeRoleAssignment.create({
              data: {
                id: randomUUID(),
                userId: input.targetUserId,
                role: input.role,
                grantedByUserId: input.actorUserId,
                revokedAt: now,
                revokedByUserId: input.actorUserId,
              },
            });
          }
          await appendBackofficeAuditEvent(
            tx,
            this.mutationAudit(input, currentActorRoles, 'SUCCEEDED', row),
          );
          return { row } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      if ('replay' in outcome) return this.replay(input, outcome.replay);
      if ('rejected' in outcome) throw BackofficeError.lastAdmin();
      return assignmentView(outcome.row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const stored = await this.prisma.backofficeAuditEvent.findUnique({
          where: {
            actorUserId_clientRequestId: {
              actorUserId: input.actorUserId,
              clientRequestId: input.clientRequestId,
            },
          },
        });
        if (stored) return this.replay(input, stored);
      }
      throw error;
    }
  }

  private async replay(
    input: RoleMutationInput,
    event: { requestHash: string | null; result: string; details: Prisma.JsonValue | null },
  ): Promise<RoleAssignmentView> {
    if (event.requestHash !== input.requestHash) throw BackofficeError.conflict();
    if (event.result === 'REJECTED') throw BackofficeError.lastAdmin();
    const details = event.details as Record<string, unknown> | null;
    if (
      !details ||
      typeof details.assignmentId !== 'string' ||
      typeof details.active !== 'boolean' ||
      typeof details.grantedAt !== 'string' ||
      typeof details.version !== 'number'
    )
      throw new Error('Persisted role command has no result snapshot');
    return {
      id: details.assignmentId,
      userId: input.targetUserId,
      role: input.role,
      active: details.active,
      grantedAt: new Date(details.grantedAt),
      revokedAt: typeof details.revokedAt === 'string' ? new Date(details.revokedAt) : null,
      version: details.version,
    };
  }

  private mutationAudit(
    input: RoleMutationInput,
    actorRoles: BackofficeRole[],
    result: 'SUCCEEDED' | 'REJECTED',
    row?: {
      id: string;
      grantedAt: Date;
      revokedAt: Date | null;
      version: number;
    },
  ) {
    return {
      actorType: 'USER' as const,
      actorUserId: input.actorUserId,
      actorRoles,
      action: input.action === 'GRANT' ? ('ROLE_GRANTED' as const) : ('ROLE_REVOKED' as const),
      targetType: 'USER',
      targetId: input.targetUserId,
      role: input.role,
      reason: input.reason,
      result,
      clientRequestId: input.clientRequestId,
      requestHash: input.requestHash,
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(row
        ? {
            details: {
              assignmentId: row.id,
              active: row.revokedAt === null,
              grantedAt: row.grantedAt.toISOString(),
              revokedAt: row.revokedAt?.toISOString() ?? null,
              version: row.version,
            },
          }
        : {}),
    };
  }

  async listAssignments(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: RoleAssignmentQuery,
    requestId?: string,
  ) {
    const cursor = decodeCursor(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.backofficeRoleAssignment.findMany({
        where: {
          ...(query.userId ? { userId: query.userId } : {}),
          ...(query.role ? { role: query.role } : {}),
          ...(query.active === undefined ? {} : { revokedAt: query.active ? null : { not: null } }),
          ...(cursor
            ? {
                OR: [
                  { grantedAt: { lt: new Date(cursor.at) } },
                  { grantedAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ grantedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId,
        actorRoles,
        action: 'ROLE_ASSIGNMENTS_VIEWED',
        targetType: 'ROLE_ASSIGNMENT_LIST',
        result: 'SUCCEEDED',
        ...(requestId ? { requestId } : {}),
        details: { filtered: Boolean(query.userId || query.role || query.active !== undefined) },
      });
      const hasMore = rows.length > query.limit;
      const items = rows.slice(0, query.limit);
      const last = items.at(-1);
      return {
        items: items.map(assignmentView),
        nextCursor:
          hasMore && last ? encodeCursor({ at: last.grantedAt.toISOString(), id: last.id }) : null,
      };
    });
  }
}
