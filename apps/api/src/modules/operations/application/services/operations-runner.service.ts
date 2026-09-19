import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import { GovernanceService } from './governance.service.js';
import { IncidentsService } from './incidents.service.js';
import { MetricsService } from './metrics.service.js';

@Injectable()
export class OperationsRunnerService {
  constructor(private readonly metrics: MetricsService, private readonly incidents: IncidentsService, private readonly governance: GovernanceService, private readonly config: ConfigService<Environment, true>) {}

  async runOnce(now = new Date()) {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true })) return { enabled: false };
    const outcomes: Record<string, unknown> = { enabled: true };
    try { outcomes.metrics = await this.metrics.generate('DAY', this.metrics.previousWindow('DAY', now), now); }
    catch (error) { outcomes.metrics = { status: 'degraded', reasonCode: error instanceof Error ? error.message : 'METRIC_RUN_FAILED' }; }
    outcomes.alert = await this.incidents.dispatchOne(now);
    outcomes.retention = await this.governance.dispatchOne(now);
    return outcomes;
  }
}
