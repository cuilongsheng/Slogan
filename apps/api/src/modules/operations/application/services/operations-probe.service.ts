import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import {
  OPERATIONS_DEPENDENCY_PROBES,
  type OperationsDependencyProbes,
} from '../../domain/ports/dependency-probes.port.js';
import { IncidentsService } from './incidents.service.js';

@Injectable()
export class OperationsProbeService {
  private readonly consecutiveFailures = new Map<string, number>();
  constructor(
    @Inject(OPERATIONS_DEPENDENCY_PROBES)
    private readonly probes: OperationsDependencyProbes,
    private readonly incidents: IncidentsService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async run(now = new Date()) {
    const results = await this.probes.check();
    const threshold = this.config.get('OPERATIONS_INCIDENT_FAILURE_THRESHOLD', { infer: true });
    for (const result of results) {
      if (!result.enabled || result.ready) {
        if ((this.consecutiveFailures.get(result.component) ?? 0) >= threshold)
          await this.incidents.recover({
            component: result.component,
            category: 'READINESS',
            scopeType: 'GLOBAL',
            scopeKey: 'configured-provider',
            ruleVersion: 'readiness-v1',
            observedAt: now,
          });
        this.consecutiveFailures.delete(result.component);
        continue;
      }
      const count = (this.consecutiveFailures.get(result.component) ?? 0) + 1;
      this.consecutiveFailures.set(result.component, count);
      if (count < threshold) continue;
      await this.incidents.observe({
        component: result.component,
        category: 'READINESS',
        severity: count >= threshold * 3 ? 'HIGH' : 'WARNING',
        scopeType: 'GLOBAL',
        scopeKey: 'configured-provider',
        ruleVersion: 'readiness-v1',
        reasonCode: result.reasonCode ?? 'DEPENDENCY_UNAVAILABLE',
        observedAt: now,
      });
    }
    return results;
  }
}
