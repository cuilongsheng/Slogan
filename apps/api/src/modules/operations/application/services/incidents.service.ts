import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import type { BackofficeRole } from '../../../backoffice/index.js';
import type { IncidentObservationInput, IncidentQuery } from '../../domain/entities/operations.js';
import { OperationsError } from '../../domain/errors/operations.error.js';
import {
  INCIDENTS_REPOSITORY,
  OPERATIONAL_ALERT_SINK,
  type IncidentsRepository,
  type OperationalAlertSink,
} from '../../domain/ports/incidents.repository.js';
import { commandHash, normalizeReason } from '../../domain/policies/operations.policy.js';

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(INCIDENTS_REPOSITORY) private readonly repository: IncidentsRepository,
    @Inject(OPERATIONAL_ALERT_SINK) private readonly sink: OperationalAlertSink,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  observe(input: IncidentObservationInput) {
    return this.repository.observe(
      input,
      this.config.get('OPERATIONS_INCIDENT_COOLDOWN_SECONDS', { infer: true }),
    );
  }
  recover(input: Omit<IncidentObservationInput, 'severity' | 'reasonCode'>) {
    return this.repository.recover(input);
  }
  list(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: IncidentQuery,
    requestId?: string,
  ) {
    return this.repository.list(actorUserId, actorRoles, query, requestId);
  }
  async detail(actorUserId: string, actorRoles: BackofficeRole[], id: string, requestId?: string) {
    const result = await this.repository.detail(actorUserId, actorRoles, id, requestId);
    if (!result) throw OperationsError.notFound();
    return result;
  }
  async trends(from: Date, to: Date) {
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to ||
      to.getTime() - from.getTime() > 366 * 86_400_000
    )
      throw OperationsError.invalid();
    const minimum = this.config.get('OPERATIONS_METRIC_MIN_SAMPLE', { infer: true });
    return (await this.repository.trends(from, to)).map((row) => ({
      component: row.component,
      severity: row.severity,
      sampleSize: row.count,
      suppressed: row.count < minimum,
      count: row.count < minimum ? null : row.count,
    }));
  }
  command(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    incidentId: string,
    action: 'ACKNOWLEDGE' | 'RESOLVE',
    reason: string,
    clientRequestId: string,
    requestId?: string,
  ) {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true }))
      throw OperationsError.unavailable();
    let normalized: string;
    try {
      normalized = normalizeReason(reason);
    } catch {
      throw OperationsError.invalid();
    }
    return this.repository.command({
      actorUserId,
      actorRoles,
      incidentId,
      action,
      reason: normalized,
      clientRequestId,
      payloadHash: commandHash({ incidentId, action, reason: normalized }),
      ...(requestId ? { requestId } : {}),
      now: new Date(),
    });
  }

  async dispatchOne(now = new Date()): Promise<{ handled: boolean; delivered?: boolean }> {
    if (!this.config.get('OPERATIONS_GOVERNANCE_ENABLED', { infer: true }))
      return { handled: false };
    const claim = await this.repository.claimDelivery(
      this.config.get('GOVERNANCE_LEASE_SECONDS', { infer: true }),
      now,
    );
    if (!claim) return { handled: false };
    try {
      await this.sink.send(claim.payload);
      await this.repository.completeDelivery(claim, new Date());
      return { handled: true, delivered: true };
    } catch (error) {
      const candidate = error instanceof Error ? error.message : '';
      const code = [
        'ALERT_SINK_NOT_CONFIGURED',
        'ALERT_SINK_REJECTED',
        'ALERT_SINK_TIMEOUT',
      ].includes(candidate)
        ? candidate
        : 'ALERT_SINK_FAILED';
      const delay = Math.min(3600, 2 ** Math.min(claim.generation, 10) * 10);
      await this.repository.failDelivery(claim, code, new Date(now.getTime() + delay * 1000));
      return { handled: true, delivered: false };
    }
  }
}
