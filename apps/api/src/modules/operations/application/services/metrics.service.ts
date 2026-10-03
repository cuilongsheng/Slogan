import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import type { BackofficeRole } from '../../../backoffice/index.js';
import type { MetricGrain, MetricSnapshotQuery, RoomOperationsQuery } from '../../domain/entities/operations.js';
import { OperationsError } from '../../domain/errors/operations.error.js';
import {
  METRICS_REPOSITORY,
  type MetricsRepository,
} from '../../domain/ports/metrics.repository.js';
import { assertMetricWindow, metricWindow } from '../../domain/policies/operations.policy.js';
import { IncidentsService } from './incidents.service.js';

@Injectable()
export class MetricsService {
  constructor(
    @Inject(METRICS_REPOSITORY) private readonly repository: MetricsRepository,
    private readonly config: ConfigService<Environment, true>,
    @Optional() private readonly incidents?: IncidentsService,
  ) {}

  enabled(): boolean {
    return this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true });
  }

  async generate(grain: MetricGrain, instant: Date, now = new Date()) {
    this.assertEnabled();
    const window = metricWindow(grain, instant);
    assertMetricWindow(window, now);
    const claim = await this.repository.claim(
      window,
      this.config.get('OPERATIONS_METRIC_DEFINITION_VERSION', { infer: true }),
      this.config.get('OPERATIONS_METRIC_LEASE_SECONDS', { infer: true }),
    );
    try {
      const facts = await this.repository.compute(window, now);
      await this.repository.commit(claim, facts, now);
      return {
        runId: claim.runId,
        grain,
        windowStart: window.start,
        windowEnd: window.end,
        snapshotCount: facts.length,
      };
    } catch (error) {
      await this.repository.fail(claim, 'METRIC_RUN_FAILED');
      throw error;
    }
  }

  async list(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: MetricSnapshotQuery,
    requestId?: string,
  ) {
    this.assertRange(query.from, query.to);
    const result = await this.repository.list(actorUserId, actorRoles, query, requestId);
    const latest = result.items.reduce<Date | null>(
      (current, item) => (!current || item.generatedAt > current ? item.generatedAt : current),
      null,
    );
    const freshnessMs =
      this.config.get('OPERATIONS_METRIC_FRESHNESS_SECONDS', { infer: true }) * 1000;
    if (this.enabled() && query.to.getTime() >= Date.now() - freshnessMs && !this.isFresh(latest))
      await this.incidents?.observe({
        component: 'METRIC_PIPELINE',
        category: 'FRESHNESS',
        severity: 'WARNING',
        scopeType: 'GLOBAL',
        scopeKey: query.grain ?? 'ALL',
        ruleVersion: this.config.get('OPERATIONS_METRIC_DEFINITION_VERSION', { infer: true }),
        reasonCode: latest ? 'METRIC_SNAPSHOT_STALE' : 'METRIC_SNAPSHOT_MISSING',
        observedAt: new Date(),
      });
    const minimum = this.config.get('OPERATIONS_METRIC_MIN_SAMPLE', { infer: true });
    return {
      ...result,
      items: result.items.map((item) => {
        const suppressed = item.sampleSize < minimum && item.status !== 'UNAVAILABLE';
        return {
          ...item,
          suppressed,
          value: suppressed ? null : item.value,
          numerator: suppressed ? null : (item.numerator?.toString() ?? null),
          denominator: suppressed ? null : (item.denominator?.toString() ?? null),
          reasonCode: suppressed ? 'MINIMUM_SAMPLE_SUPPRESSED' : (item.reasonCode ?? null),
          fresh: this.isFresh(item.generatedAt),
        };
      }),
    };
  }

  online() {
    return this.repository.currentOnline();
  }
  rooms(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: RoomOperationsQuery,
    requestId?: string,
  ) {
    return this.repository.rooms(actorUserId, actorRoles, query, requestId);
  }
  activeUsers(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    from: Date,
    to: Date,
    cursor: string | undefined,
    limit: number,
    requestId?: string,
  ) {
    this.assertRange(from, to);
    return this.repository.activeUsers(actorUserId, actorRoles, from, to, cursor, limit, requestId);
  }

  previousWindow(grain: MetricGrain, now = new Date()) {
    const current = metricWindow(grain, now);
    return new Date(current.start.getTime() - (grain === 'DAY' ? 86_400_000 : 604_800_000));
  }

  isFresh(generatedAt: Date | null, now = new Date()): boolean {
    return (
      !!generatedAt &&
      now.getTime() - generatedAt.getTime() <=
        this.config.get('OPERATIONS_METRIC_FRESHNESS_SECONDS', { infer: true }) * 1000
    );
  }

  private assertEnabled(): void {
    if (!this.enabled()) throw OperationsError.unavailable();
  }

  private assertRange(from: Date, to: Date): void {
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to ||
      to.getTime() - from.getTime() > 366 * 86_400_000
    )
      throw OperationsError.invalid();
  }
}
