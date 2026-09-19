import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  BackofficeAuditEventView,
  BackofficeAuditQuery,
  BackofficeAuditRole,
} from '../domain/entities/backoffice-audit.js';
import type { BackofficeAuditRepository } from '../domain/ports/backoffice-audit.repository.js';
import { appendBackofficeAuditEvent } from './backoffice-audit.writer.js';
type Cursor = { at: string; id: string };
const encode = (value: Cursor) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(value?: string): Cursor | undefined {
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
@Injectable()
export class PrismaBackofficeAuditRepository implements BackofficeAuditRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(
    actorUserId: string,
    actorRoles: BackofficeAuditRole[],
    query: BackofficeAuditQuery,
    requestId?: string,
  ) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.backofficeAuditEvent.findMany({
        where: {
          ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
          ...(query.action ? { action: query.action } : {}),
          ...(query.targetType ? { targetType: query.targetType } : {}),
          ...(query.targetId ? { targetId: query.targetId } : {}),
          ...(query.result ? { result: query.result } : {}),
          ...(query.from || query.to
            ? {
                occurredAt: {
                  ...(query.from ? { gte: query.from } : {}),
                  ...(query.to ? { lte: query.to } : {}),
                },
              }
            : {}),
          ...(cursor
            ? {
                OR: [
                  { occurredAt: { lt: new Date(cursor.at) } },
                  { occurredAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId,
        actorRoles,
        action: 'AUDIT_EVENTS_VIEWED',
        targetType: 'BACKOFFICE_AUDIT_LIST',
        result: 'SUCCEEDED',
        ...(requestId ? { requestId } : {}),
        details: {
          filtered: Boolean(
            query.actorUserId ||
            query.action ||
            query.targetType ||
            query.targetId ||
            query.result ||
            query.from ||
            query.to,
          ),
        },
      });
      const more = rows.length > query.limit,
        items = rows.slice(0, query.limit),
        last = items.at(-1);
      return {
        items: items as BackofficeAuditEventView[],
        nextCursor:
          more && last ? encode({ at: last.occurredAt.toISOString(), id: last.id }) : null,
      };
    });
  }
}
