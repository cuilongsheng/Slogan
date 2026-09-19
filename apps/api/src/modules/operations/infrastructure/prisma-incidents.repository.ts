import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type OperationalIncident } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { appendBackofficeAuditEvent } from '../../audit/index.js';
import type { IncidentObservationInput, IncidentQuery, IncidentView } from '../domain/entities/operations.js';
import { OperationsError } from '../domain/errors/operations.error.js';
import type { AlertDeliveryClaim, IncidentCommandInput, IncidentsRepository } from '../domain/ports/incidents.repository.js';
import { incidentFingerprint, normalizeReason } from '../domain/policies/operations.policy.js';

type Cursor = { at: string; id: string };
const encode = (value: Cursor) => Buffer.from(JSON.stringify(value)).toString('base64url');
function decode(value?: string): Cursor | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (!parsed.id || Number.isNaN(Date.parse(parsed.at))) throw new Error();
    return parsed;
  } catch {
    throw OperationsError.invalid();
  }
}

function view(row: OperationalIncident): IncidentView {
  return {
    id: row.id,
    component: row.component,
    category: row.category,
    severity: row.severity,
    scopeType: row.scopeType,
    scopeKey: row.scopeKey,
    ruleVersion: row.ruleVersion,
    reasonCode: row.reasonCode,
    occurrence: row.occurrence,
    status: row.status,
    observationCount: row.observationCount,
    firstObservedAt: row.firstObservedAt,
    lastObservedAt: row.lastObservedAt,
    acknowledgedAt: row.acknowledgedAt,
    acknowledgedBy: row.acknowledgedBy,
    acknowledgeReason: row.acknowledgeReason,
    resolvedAt: row.resolvedAt,
    resolvedBy: row.resolvedBy,
    resolutionReason: row.resolutionReason,
    observedAt: row.lastObservedAt,
  };
}

@Injectable()
export class PrismaIncidentsRepository implements IncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async observe(input: IncidentObservationInput): Promise<IncidentView> {
    const fingerprint = incidentFingerprint(input);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint}, 0))`;
      let row = await tx.operationalIncident.findFirst({
        where: { fingerprint, status: { not: 'RESOLVED' } },
        orderBy: { occurrence: 'desc' },
      });
      if (row) {
        row = await tx.operationalIncident.update({
          where: { id: row.id },
          data: {
            severity: input.severity,
            reasonCode: input.reasonCode,
            lastObservedAt: input.observedAt,
            observationCount: { increment: 1 },
          },
        });
      } else {
        const last = await tx.operationalIncident.findFirst({
          where: { fingerprint },
          orderBy: { occurrence: 'desc' },
          select: { occurrence: true },
        });
        row = await tx.operationalIncident.create({
          data: {
            id: randomUUID(),
            fingerprint,
            occurrence: (last?.occurrence ?? 0) + 1,
            component: input.component,
            category: input.category,
            severity: input.severity,
            scopeType: input.scopeType,
            scopeKey: input.scopeKey,
            ruleVersion: input.ruleVersion,
            reasonCode: input.reasonCode,
            firstObservedAt: input.observedAt,
            lastObservedAt: input.observedAt,
          },
        });
        await tx.operationalAlertDelivery.create({
          data: { id: randomUUID(), incidentId: row.id },
        });
      }
      await tx.operationalIncidentObservation.create({
        data: {
          id: randomUUID(),
          incidentId: row.id,
          reasonCode: input.reasonCode,
          observedAt: input.observedAt,
        },
      });
      return view(row);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async list(actorUserId: string, actorRoles: IncidentCommandInput['actorRoles'], query: IncidentQuery, requestId?: string) {
    const cursor = decode(query.cursor);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.operationalIncident.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.severity ? { severity: query.severity } : {}),
          ...(query.component ? { component: query.component } : {}),
          ...(query.from || query.to ? { lastObservedAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lt: query.to } : {}) } } : {}),
          ...(cursor ? { OR: [{ lastObservedAt: { lt: new Date(cursor.at) } }, { lastObservedAt: new Date(cursor.at), id: { lt: cursor.id } }] } : {}),
        },
        orderBy: [{ lastObservedAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER', actorUserId, actorRoles, action: 'OPERATIONAL_INCIDENTS_VIEWED',
        targetType: 'OPERATIONAL_INCIDENT_LIST', result: 'SUCCEEDED', ...(requestId ? { requestId } : {}),
        details: { status: query.status ?? null, severity: query.severity ?? null, component: query.component ?? null, limit: query.limit },
      });
      const page = rows.slice(0, query.limit);
      return { items: page.map(view), nextCursor: rows.length > query.limit && page.at(-1) ? encode({ at: page.at(-1)!.lastObservedAt.toISOString(), id: page.at(-1)!.id }) : null };
    });
  }

  async detail(actorUserId: string, actorRoles: IncidentCommandInput['actorRoles'], incidentId: string, requestId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.operationalIncident.findUnique({ where: { id: incidentId } });
      if (!row) return null;
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER', actorUserId, actorRoles, action: 'OPERATIONAL_INCIDENTS_VIEWED',
        targetType: 'OPERATIONAL_INCIDENT', targetId: incidentId, result: 'SUCCEEDED', ...(requestId ? { requestId } : {}),
      });
      return view(row);
    });
  }

  async command(input: IncidentCommandInput): Promise<IncidentView> {
    const reason = normalizeReason(input.reason);
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.operationalCommand.findUnique({
        where: { actorUserId_clientRequestId: { actorUserId: input.actorUserId, clientRequestId: input.clientRequestId } },
      });
      if (replay) {
        if (replay.payloadHash !== input.payloadHash) throw OperationsError.conflict();
        return replay.result as unknown as IncidentView;
      }
      const current = await tx.operationalIncident.findUnique({ where: { id: input.incidentId } });
      if (!current) throw OperationsError.notFound();
      if (input.action === 'ACKNOWLEDGE' && current.status !== 'OPEN') throw OperationsError.conflict('INCIDENT_STATE_CONFLICT');
      if (input.action === 'RESOLVE' && current.status === 'RESOLVED') throw OperationsError.conflict('INCIDENT_STATE_CONFLICT');
      const updated = await tx.operationalIncident.update({
        where: { id: current.id },
        data: input.action === 'ACKNOWLEDGE'
          ? { status: 'ACKNOWLEDGED', acknowledgedAt: input.now, acknowledgedBy: input.actorUserId, acknowledgeReason: reason }
          : { status: 'RESOLVED', resolvedAt: input.now, resolvedBy: input.actorUserId, resolutionReason: reason },
      });
      const result = view(updated);
      await tx.operationalCommand.create({
        data: { id: randomUUID(), actorUserId: input.actorUserId, clientRequestId: input.clientRequestId, action: input.action === 'ACKNOWLEDGE' ? 'ACKNOWLEDGE_INCIDENT' : 'RESOLVE_INCIDENT', payloadHash: input.payloadHash, result: result as unknown as Prisma.InputJsonValue },
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER', actorUserId: input.actorUserId, actorRoles: input.actorRoles,
        action: input.action === 'ACKNOWLEDGE' ? 'OPERATIONAL_INCIDENT_ACKNOWLEDGED' : 'OPERATIONAL_INCIDENT_RESOLVED',
        targetType: 'OPERATIONAL_INCIDENT', targetId: input.incidentId, reason, result: 'SUCCEEDED',
        clientRequestId: input.clientRequestId, requestHash: input.payloadHash, ...(input.requestId ? { requestId: input.requestId } : {}),
      });
      return result;
    });
  }

  async trends(from: Date, to: Date) {
    const rows = await this.prisma.operationalIncident.groupBy({
      by: ['component', 'severity'], where: { firstObservedAt: { gte: from, lt: to } }, _count: { _all: true },
      orderBy: [{ component: 'asc' }, { severity: 'asc' }],
    });
    return rows.map((row) => ({ component: row.component, severity: row.severity, count: row._count._all }));
  }

  async claimDelivery(leaseSeconds: number, now: Date): Promise<AlertDeliveryClaim | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "OperationalAlertDelivery"
        WHERE status IN ('PENDING','FAILED') AND "nextAttemptAt" <= ${now}
          AND ("lockedUntil" IS NULL OR "lockedUntil" <= ${now})
        ORDER BY "nextAttemptAt", id FOR UPDATE SKIP LOCKED LIMIT 1`;
      const candidate = rows[0];
      if (!candidate) return null;
      const leaseId = randomUUID();
      const delivery = await tx.operationalAlertDelivery.update({
        where: { id: candidate.id }, data: { status: 'RUNNING', leaseId, generation: { increment: 1 }, lockedUntil: new Date(now.getTime() + leaseSeconds * 1000), attempts: { increment: 1 } },
        include: { incident: true },
      });
      return { id: delivery.id, incidentId: delivery.incidentId, leaseId, generation: delivery.generation, payload: {
        component: delivery.incident.component, category: delivery.incident.category, severity: delivery.incident.severity,
        scopeType: delivery.incident.scopeType, reasonCode: delivery.incident.reasonCode,
        firstObservedAt: delivery.incident.firstObservedAt.toISOString(),
      } };
    });
  }

  async completeDelivery(claim: AlertDeliveryClaim, now: Date): Promise<void> {
    const result = await this.prisma.operationalAlertDelivery.updateMany({ where: { id: claim.id, leaseId: claim.leaseId, generation: claim.generation, status: 'RUNNING' }, data: { status: 'DELIVERED', deliveredAt: now, lockedUntil: null, lastError: null } });
    if (result.count !== 1) throw OperationsError.conflict('ALERT_DELIVERY_FENCED');
  }

  async failDelivery(claim: AlertDeliveryClaim, errorCode: string, retryAt: Date): Promise<void> {
    const result = await this.prisma.operationalAlertDelivery.updateMany({ where: { id: claim.id, leaseId: claim.leaseId, generation: claim.generation, status: 'RUNNING' }, data: { status: 'FAILED', lastError: errorCode, nextAttemptAt: retryAt, lockedUntil: null } });
    if (result.count !== 1) throw OperationsError.conflict('ALERT_DELIVERY_FENCED');
  }
}
