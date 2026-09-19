import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { RoomSpeechSafetyError } from '../domain/errors/room-speech-safety.error.js';
import type {
  RoomSpeechAlert,
  SafetyCapabilityIncidentView,
} from '../domain/entities/room-speech-safety.js';
import type { RoomSpeechRepository } from '../domain/ports/room-speech.repository.js';
import { appendBackofficeAuditEvent } from '../../audit/index.js';

@Injectable()
export class PrismaRoomSpeechRepository implements RoomSpeechRepository {
  constructor(private readonly prisma: PrismaService) {}

  async activeRooms(now = new Date()) {
    return this.prisma.room.findMany({
      where: {
        sensitiveSpeechDetectionEnabled: true,
        status: 'OPEN',
        endsAt: { gt: now },
      },
      select: { id: true, endsAt: true },
      orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
      take: 500,
    });
  }

  async participant(roomId: string, participantIdentity: string, noticeVersion: string) {
    const identity = await this.prisma.realtimeIdentity.findFirst({
      where: {
        identity: participantIdentity,
        roomId,
        revokedAt: null,
        membership: {
          lifecycle: 'ACTIVE',
          room: {
            sensitiveSpeechDetectionEnabled: true,
            status: 'OPEN',
            endsAt: { gt: new Date() },
          },
        },
      },
      include: { membership: { include: { room: true } } },
    });
    if (!identity) return null;
    const consent = await this.prisma.speechProcessingConsentEvent.findFirst({
      where: { userId: identity.membership.userId, purpose: 'ROOM_SAFETY_DETECTION' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (consent?.action !== 'ACCEPT' || consent.noticeVersion !== noticeVersion) return null;
    return {
      roomId,
      userId: identity.membership.userId,
      participantIdentity,
      consentGeneration: consent.id,
      roomEndsAt: identity.membership.room.endsAt,
    };
  }

  async recordRisk(input: Parameters<RoomSpeechRepository['recordRisk']>[0]) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.roomSpeechRiskEvent.findUnique({
        where: {
          roomId_subjectUserId_category_ruleSetVersion_correlationHash: {
            roomId: input.context.roomId,
            subjectUserId: input.context.userId,
            category: input.classification.category,
            ruleSetVersion: input.classification.ruleSetVersion,
            correlationHash: input.correlationHash,
          },
        },
      });
      const risk = existing
        ? await tx.roomSpeechRiskEvent.update({
            where: { id: existing.id },
            data: {
              lastOccurredAt: input.occurredAt,
              occurrenceCount: { increment: 1 },
              severity: input.classification.severity,
            },
          })
        : await tx.roomSpeechRiskEvent.create({
            data: {
              id: randomUUID(),
              roomId: input.context.roomId,
              subjectUserId: input.context.userId,
              category: input.classification.category,
              severity: input.classification.severity,
              ruleSetVersion: input.classification.ruleSetVersion,
              correlationHash: input.correlationHash,
              firstOccurredAt: input.occurredAt,
              lastOccurredAt: input.occurredAt,
            },
          });
      if (!existing) {
        const room = await tx.room.findUniqueOrThrow({
          where: { id: input.context.roomId },
          select: { endsAt: true },
        });
        const expiresAt = new Date(
          Math.min(
            room.endsAt.getTime(),
            input.occurredAt.getTime() + input.alertTtlSeconds * 1000,
          ),
        );
        await tx.roomSpeechAlertDelivery.create({
          data: {
            id: randomUUID(),
            riskEventId: risk.id,
            expiresAt,
            nextAttemptAt: input.occurredAt,
          },
        });
      }
      return this.alert(risk);
    });
  }

  async listHostAlerts(input: Parameters<RoomSpeechRepository['listHostAlerts']>[0]) {
    const room = await this.prisma.room.findUnique({
      where: { id: input.roomId },
      select: { hostUserId: true },
    });
    if (!room || room.hostUserId !== input.actorUserId) throw RoomSpeechSafetyError.hostRequired();
    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;
    const rows = await this.prisma.roomSpeechRiskEvent.findMany({
      where: {
        roomId: input.roomId,
        ...(cursor
          ? {
              OR: [
                { lastOccurredAt: { lt: cursor.at } },
                { lastOccurredAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastOccurredAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => this.alert(row)),
      nextCursor:
        rows.length > input.limit && last ? this.encodeCursor(last.lastOccurredAt, last.id) : null,
    };
  }

  async openIncident(input: Parameters<RoomSpeechRepository['openIncident']>[0]) {
    const activeKey = [input.roomId ?? 'platform', input.component, input.errorCategory].join(':');
    const row = await this.prisma.safetyCapabilityIncident.upsert({
      where: { activeKey },
      create: {
        id: randomUUID(),
        ...(input.roomId ? { roomId: input.roomId } : {}),
        component: input.component,
        errorCategory: input.errorCategory,
        ...(input.providerCategory ? { providerCategory: input.providerCategory } : {}),
        activeKey,
        startedAt: input.now,
        lastObservedAt: input.now,
      },
      update: {
        lastObservedAt: input.now,
        affectedWindows: { increment: 1 },
        ...(input.providerCategory ? { providerCategory: input.providerCategory } : {}),
      },
    });
    return this.incident(row);
  }

  async recoverIncident(input: Parameters<RoomSpeechRepository['recoverIncident']>[0]) {
    const activeKey = [input.roomId ?? 'platform', input.component, input.errorCategory].join(':');
    await this.prisma.safetyCapabilityIncident.updateMany({
      where: { activeKey, status: 'OPEN' },
      data: {
        status: 'RECOVERED',
        recoveredAt: input.now,
        lastObservedAt: input.now,
        activeKey: null,
      },
    });
  }

  async listIncidents(input: Parameters<RoomSpeechRepository['listIncidents']>[0]) {
    const cursor = input.cursor ? this.decodeCursor(input.cursor) : null;
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.safetyCapabilityIncident.findMany({
        where: {
          ...(input.roomId ? { roomId: input.roomId } : {}),
          ...(input.component ? { component: input.component } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.from || input.to
            ? {
                lastObservedAt: {
                  ...(input.from ? { gte: input.from } : {}),
                  ...(input.to ? { lte: input.to } : {}),
                },
              }
            : {}),
          ...(cursor
            ? {
                OR: [
                  { lastObservedAt: { lt: cursor.at } },
                  { lastObservedAt: cursor.at, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ lastObservedAt: 'desc' }, { id: 'desc' }],
        take: input.limit + 1,
      });
      await appendBackofficeAuditEvent(tx, {
        actorType: 'USER',
        actorUserId: input.actorUserId,
        actorRoles: input.actorRoles,
        action: 'SAFETY_CAPABILITY_INCIDENTS_VIEWED',
        targetType: 'SAFETY_CAPABILITY_INCIDENT_LIST',
        result: 'SUCCEEDED',
        ...(input.requestId ? { requestId: input.requestId } : {}),
        details: {
          filtered: Boolean(
            input.roomId || input.component || input.status || input.from || input.to,
          ),
        },
      });
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        items: page.map((row) => this.incident(row)),
        nextCursor:
          rows.length > input.limit && last
            ? this.encodeCursor(last.lastObservedAt, last.id)
            : null,
      };
    });
  }

  async claimDeliveries(now = new Date()) {
    const candidates = await this.prisma.roomSpeechAlertDelivery.findMany({
      where: {
        OR: [
          { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
          { status: 'RUNNING', lockedUntil: { lte: now } },
        ],
      },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: 50,
      select: { id: true },
    });
    const claimed = [];
    for (const candidate of candidates) {
      const result = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "RoomSpeechAlertDelivery" WHERE "id"=${candidate.id}::uuid AND (("status" IN ('PENDING','FAILED') AND "nextAttemptAt" <= ${now}) OR ("status"='RUNNING' AND "lockedUntil" <= ${now})) FOR UPDATE SKIP LOCKED`,
        );
        if (!rows.length) return null;
        const current = await tx.roomSpeechAlertDelivery.findUniqueOrThrow({
          where: { id: candidate.id },
          include: { riskEvent: { include: { room: true } } },
        });
        if (current.expiresAt <= now) {
          await tx.roomSpeechAlertDelivery.update({
            where: { id: current.id },
            data: { status: 'EXPIRED', lockedUntil: null, leaseId: null },
          });
          return null;
        }
        const leaseId = randomUUID();
        await tx.roomSpeechAlertDelivery.update({
          where: { id: current.id },
          data: {
            status: 'RUNNING',
            leaseId,
            lockedUntil: new Date(now.getTime() + 30_000),
            attempts: { increment: 1 },
          },
        });
        return {
          id: current.id,
          leaseId,
          roomId: current.riskEvent.roomId,
          alert: this.alert(current.riskEvent),
          expiresAt: current.expiresAt,
        };
      });
      if (result) claimed.push(result);
    }
    return claimed;
  }

  async resolveDeliveryTarget(id: string, leaseId: string): Promise<string | null> {
    const current = await this.prisma.roomSpeechAlertDelivery.findFirst({
      where: { id, leaseId, status: 'RUNNING' },
      include: { riskEvent: { include: { room: true } } },
    });
    if (!current) return null;
    const host = await this.prisma.roomMembership.findFirst({
      where: {
        roomId: current.riskEvent.roomId,
        userId: current.riskEvent.room.hostUserId,
        lifecycle: 'ACTIVE',
      },
      include: {
        realtimeIdentities: {
          where: { revokedAt: null, issueUntil: { gt: new Date() } },
          orderBy: { issueUntil: 'desc' },
          take: 1,
        },
      },
    });
    return host?.realtimeIdentities[0]?.identity ?? null;
  }

  async completeDelivery(id: string, leaseId: string, deliveredAt: Date) {
    await this.prisma.roomSpeechAlertDelivery.updateMany({
      where: { id, leaseId, status: 'RUNNING' },
      data: {
        status: 'DELIVERED',
        deliveredAt,
        leaseId: null,
        lockedUntil: null,
        lastError: null,
      },
    });
  }

  async failDelivery(id: string, leaseId: string, errorCategory: string, now: Date) {
    const row = await this.prisma.roomSpeechAlertDelivery.findFirst({
      where: { id, leaseId, status: 'RUNNING' },
    });
    if (!row) return;
    const expired = row.expiresAt <= now;
    await this.prisma.roomSpeechAlertDelivery.update({
      where: { id },
      data: expired
        ? { status: 'EXPIRED', leaseId: null, lockedUntil: null, lastError: errorCategory }
        : {
            status: 'FAILED',
            leaseId: null,
            lockedUntil: null,
            lastError: errorCategory,
            nextAttemptAt: new Date(now.getTime() + Math.min(60_000, 1000 * 2 ** row.attempts)),
          },
    });
  }

  async purge(before: Date) {
    const deliveries = await this.prisma.roomSpeechAlertDelivery.deleteMany({
      where: { createdAt: { lt: before }, status: { in: ['DELIVERED', 'EXPIRED'] } },
    });
    const risks = await this.prisma.roomSpeechRiskEvent.deleteMany({
      where: { lastOccurredAt: { lt: before } },
    });
    const incidents = await this.prisma.safetyCapabilityIncident.deleteMany({
      where: { lastObservedAt: { lt: before }, status: 'RECOVERED' },
    });
    return { risks: risks.count, incidents: incidents.count, deliveries: deliveries.count };
  }

  private alert(row: {
    id: string;
    roomId: string;
    subjectUserId: string;
    category: RoomSpeechAlert['category'];
    severity: RoomSpeechAlert['severity'];
    ruleSetVersion: string;
    firstOccurredAt: Date;
    lastOccurredAt: Date;
    occurrenceCount: number;
  }): RoomSpeechAlert {
    return { ...row };
  }

  private incident(row: {
    id: string;
    roomId: string | null;
    component: SafetyCapabilityIncidentView['component'];
    errorCategory: string;
    providerCategory: string | null;
    status: SafetyCapabilityIncidentView['status'];
    startedAt: Date;
    lastObservedAt: Date;
    recoveredAt: Date | null;
    affectedWindows: number;
  }): SafetyCapabilityIncidentView {
    return { ...row };
  }

  private encodeCursor(at: Date, id: string): string {
    return Buffer.from(JSON.stringify({ v: 1, at: at.toISOString(), id })).toString('base64url');
  }

  private decodeCursor(value: string): { at: Date; id: string } {
    try {
      const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
        v?: unknown;
        at?: unknown;
        id?: unknown;
      };
      if (
        decoded.v !== 1 ||
        typeof decoded.at !== 'string' ||
        typeof decoded.id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(decoded.id)
      )
        throw new Error('shape');
      const at = new Date(decoded.at);
      if (Number.isNaN(at.getTime()) || at.toISOString() !== decoded.at) throw new Error('date');
      return { at, id: decoded.id };
    } catch {
      throw RoomSpeechSafetyError.cursorInvalid();
    }
  }
}
