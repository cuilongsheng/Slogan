import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import type { BackofficeRole } from '../../../backoffice/index.js';
import type { MetricGrain, MetricKey, MetricSnapshotQuery } from '../../domain/entities/operations.js';
import { OperationsError } from '../../domain/errors/operations.error.js';
import { METRICS_REPOSITORY, type MetricsRepository } from '../../domain/ports/metrics.repository.js';
import { assertMetricWindow, metricWindow } from '../../domain/policies/operations.policy.js';

@Injectable()
export class MetricsService {
  constructor(
    @Inject(METRICS_REPOSITORY) private readonly repository: MetricsRepository,
    private readonly config: ConfigService<Environment, true>,
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
      return { runId: claim.runId, grain, windowStart: window.start, windowEnd: window.end, snapshotCount: facts.length };
    } catch (error) {
      await this.repository.fail(claim, error instanceof Error ? error.message.slice(0, 64) : 'UNKNOWN');
      throw error;
    }
  }

  async list(actorUserId: string, actorRoles: BackofficeRole[], query: MetricSnapshotQuery, requestId?: string) {
    const result = await this.repository.list(actorUserId, actorRoles, query, requestId);
    const minimum = this.config.get('OPERATIONS_METRIC_MIN_SAMPLE', { infer: true });
    return {
      ...result,
      items: result.items.map((item) => {
        const suppressed = item.sampleSize < minimum && item.status !== 'UNAVAILABLE';
        return {
          ...item,
          suppressed,
          value: suppressed ? null : item.value,
          numerator: suppressed ? null : item.numerator?.toString() ?? null,
          denominator: suppressed ? null : item.denominator?.toString() ?? null,
          reasonCode: suppressed ? 'MINIMUM_SAMPLE_SUPPRESSED' : item.reasonCode ?? null,
        };
      }),
    };
  }

  online() { return this.repository.currentOnline(); }
  rooms(actorUserId: string, actorRoles: BackofficeRole[], cursor: string | undefined, limit: number, requestId?: string) {
    return this.repository.rooms(actorUserId, actorRoles, cursor, limit, requestId);
  }
  activeUsers(actorUserId: string, actorRoles: BackofficeRole[], from: Date, to: Date, cursor: string | undefined, limit: number, requestId?: string) {
    return this.repository.activeUsers(actorUserId, actorRoles, from, to, cursor, limit, requestId);
  }

  previousWindow(grain: MetricGrain, now = new Date()) {
    const current = metricWindow(grain, now);
    return new Date(current.start.getTime() - (grain === 'DAY' ? 86_400_000 : 604_800_000));
  }

  isFresh(generatedAt: Date | null, now = new Date()): boolean {
    return !!generatedAt && now.getTime() - generatedAt.getTime() <= this.config.get('OPERATIONS_METRIC_FRESHNESS_SECONDS', { infer: true }) * 1000;
  }

  private assertEnabled(): void {
    if (!this.enabled()) throw OperationsError.unavailable();
  }
}
