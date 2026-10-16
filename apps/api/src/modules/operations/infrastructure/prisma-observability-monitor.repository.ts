import { randomUUID } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import type {
  MonitorClaim,
  MonitorProbe,
  MonitorScan,
  ObservabilityMonitorRepository,
} from '../domain/ports/observability-monitor.repository.js';
import { PrismaIncidentsRepository } from './prisma-incidents.repository.js';

const components = new Set([
  'POSTGRESQL',
  'REDIS',
  'LIVEKIT',
  'AI',
  'STT',
  'SMS',
  'REALTIME_COMMAND',
  'POST_ROOM_KEYWORDS',
  'SAFETY_CASE',
  'SAFETY_RESTRICTION',
]);
const reasonCodes = new Set([
  'POSTGRESQL_UNAVAILABLE',
  'REDIS_UNAVAILABLE',
  'LIVEKIT_UNAVAILABLE',
  'AI_UNAVAILABLE',
  'STT_UNAVAILABLE',
  'SMS_UNAVAILABLE',
  'AI_CONFIGURATION_INVALID',
  'STT_CONFIGURATION_INVALID',
  'SMS_CONFIGURATION_INVALID',
  'AI_AUTH_REJECTED',
  'STT_AUTH_REJECTED',
  'SMS_AUTH_REJECTED',
  'AI_READINESS_UNKNOWN',
  'STT_READINESS_UNKNOWN',
  'SMS_READINESS_UNKNOWN',
  'COMMAND_BACKLOG',
  'JOB_DEADLINE_EXCEEDED',
  'CASE_ASSIGNMENT_DELAYED',
  'RESTRICTION_RECOVERY_DELAYED',
  'DEPENDENCY_UNAVAILABLE',
]);

@Injectable()
export class PrismaObservabilityMonitorRepository implements ObservabilityMonitorRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: PrismaIncidentsRepository,
    @Optional() private readonly config?: ConfigService<Environment, true>,
  ) {}
  private key(environment: string, monitorKey = 'SCAN') {
    return { environment_monitorKey: { environment, monitorKey } };
  }
  async claim(
    environment: string,
    window: number,
    now: Date,
    leaseSeconds: number,
  ): Promise<MonitorScan> {
    if (
      !['production', 'preview', 'test', 'development'].includes(environment) ||
      !Number.isSafeInteger(window) ||
      window < 0
    )
      throw new Error('INVALID_MONITOR_WINDOW');
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`monitor:${environment}`}, 0))`;
        const row = await tx.observabilityMonitorState.upsert({
          where: this.key(environment),
          create: { environment, monitorKey: 'SCAN' },
          update: {},
        });
        if (row.completedWindow >= BigInt(window))
          return {
            kind: 'completed',
            nextWindow:
              row.completedWindow === BigInt(window) && row.nextWindow !== null
                ? Number(row.nextWindow)
                : null,
          };
        if (row.lockedUntil && row.lockedUntil > now) throw new Error('MONITOR_SCAN_BUSY');
        const leaseId = randomUUID();
        const updated = await tx.observabilityMonitorState.update({
          where: this.key(environment),
          data: {
            leaseId,
            lockedUntil: new Date(now.getTime() + leaseSeconds * 1000),
            generation: { increment: 1 },
          },
        });
        return {
          kind: 'claimed',
          claim: { environment, window, leaseId, generation: updated.generation },
        };
      },
      { maxWait: 2000, timeout: 5000 },
    );
  }
  private async fence(tx: Prisma.TransactionClient, claim: MonitorClaim, now: Date): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`monitor:${claim.environment}`}, 0))`;
    const scan = await tx.observabilityMonitorState.findUnique({
      where: this.key(claim.environment),
    });
    if (
      scan?.leaseId !== claim.leaseId ||
      scan.generation !== claim.generation ||
      !scan.lockedUntil ||
      scan.lockedUntil <= now
    )
      throw new Error('MONITOR_LEASE_LOST');
  }
  async record(
    claim: MonitorClaim,
    probe: MonitorProbe,
    threshold: number,
    cooldownSeconds: number,
    now: Date,
  ): Promise<void> {
    if (
      !components.has(probe.component) ||
      !['READINESS', 'BACKLOG'].includes(probe.category) ||
      !reasonCodes.has(probe.reasonCode)
    )
      throw new Error('INVALID_MONITOR_OBSERVATION');
    await this.prisma.$transaction(
      async (tx) => {
        await this.fence(tx, claim, now);
        const monitorKey = `${probe.category}:${probe.component}`;
        const row = await tx.observabilityMonitorState.upsert({
          where: this.key(claim.environment, monitorKey),
          create: { environment: claim.environment, monitorKey },
          update: {},
        });
        if (row.completedWindow >= BigInt(claim.window)) return;
        const count = probe.unknown
          ? row.consecutiveFailures
          : probe.enabled && !probe.ready
            ? row.consecutiveFailures + 1
            : 0;
        await tx.observabilityMonitorState.update({
          where: this.key(claim.environment, monitorKey),
          data: {
            completedWindow: BigInt(claim.window),
            lastCompletedAt: now,
            consecutiveFailures: count,
          },
        });
        const identity = {
          component: probe.component,
          category: 'READINESS',
          scopeType: 'GLOBAL',
          scopeKey: probe.category === 'READINESS' ? 'configured-provider' : 'platform',
          ruleVersion:
            probe.category === 'READINESS'
              ? 'readiness-v1'
              : (this.config?.get('OPERATIONS_METRIC_DEFINITION_VERSION', { infer: true }) ??
                '2026-09-v1'),
          observedAt: now,
        };
        if (probe.unknown) return;
        if (count >= threshold)
          await this.incidents.observeInTransaction(
            tx,
            {
              ...identity,
              severity: count >= threshold * 3 ? 'HIGH' : 'WARNING',
              reasonCode: probe.reasonCode,
            },
            cooldownSeconds,
          );
        if (count === 0) await this.incidents.recoverInTransaction(tx, identity);
      },
      { maxWait: 2000, timeout: 5000 },
    );
  }
  async complete(claim: MonitorClaim, nextWindow: number, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.fence(tx, claim, now);
      await tx.observabilityMonitorState.update({
        where: this.key(claim.environment),
        data: {
          completedWindow: BigInt(claim.window),
          nextWindow: BigInt(nextWindow),
          lastCompletedAt: now,
          leaseId: null,
          lockedUntil: null,
        },
      });
    });
  }
  async release(claim: MonitorClaim): Promise<void> {
    await this.prisma.observabilityMonitorState.updateMany({
      where: {
        environment: claim.environment,
        monitorKey: 'SCAN',
        leaseId: claim.leaseId,
        generation: claim.generation,
      },
      data: { leaseId: null, lockedUntil: null },
    });
  }
  async backlog(now: Date, deadlineSeconds: number): Promise<MonitorProbe[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const deadline = new Date(now.getTime() - deadlineSeconds * 1000);
        const [commands, keywords, cases, restrictions] = await Promise.all([
          tx.realtimeCommand.count({
            where: {
              status: { in: ['PENDING', 'FAILED', 'RUNNING'] },
              createdAt: { lt: deadline },
              nextAttemptAt: { lte: now },
              OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
            },
          }),
          tx.roomKeywordSummaryJob.count({
            where: { status: { in: ['PENDING', 'FAILED', 'RUNNING'] }, deadlineAt: { lt: now } },
          }),
          tx.safetyCase.count({
            where: {
              status: 'OPEN',
              assigneeUserId: null,
              createdAt: { lt: new Date(now.getTime() - 600_000) },
            },
          }),
          tx.safetyRestriction.count({
            where: { status: 'ACTIVE', endsAt: { not: null, lte: now } },
          }),
        ]);
        return [
          { component: 'REALTIME_COMMAND', count: commands, reasonCode: 'COMMAND_BACKLOG' },
          { component: 'POST_ROOM_KEYWORDS', count: keywords, reasonCode: 'JOB_DEADLINE_EXCEEDED' },
          { component: 'SAFETY_CASE', count: cases, reasonCode: 'CASE_ASSIGNMENT_DELAYED' },
          {
            component: 'SAFETY_RESTRICTION',
            count: restrictions,
            reasonCode: 'RESTRICTION_RECOVERY_DELAYED',
          },
        ].map((probe) => ({
          component: probe.component,
          category: 'BACKLOG' as const,
          enabled: true,
          ready: probe.count === 0,
          reasonCode: probe.reasonCode,
        }));
      },
      { maxWait: 2000, timeout: 5000 },
    );
  }
}
