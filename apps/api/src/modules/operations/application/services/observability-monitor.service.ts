import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MONITOR_SCHEDULER,
  type MonitorScheduler,
} from '../../domain/ports/monitor-scheduler.port.js';
import type { Environment } from '../../../../config/environment.js';
import { ObservabilityHeartbeat } from '../../../../infrastructure/observability/heartbeat.service.js';
import {
  OPERATIONS_DEPENDENCY_PROBES,
  type OperationsDependencyProbes,
} from '../../domain/ports/dependency-probes.port.js';
import {
  OBSERVABILITY_MONITOR_REPOSITORY,
  type ObservabilityMonitorRepository,
  type MonitorClaim,
} from '../../domain/ports/observability-monitor.repository.js';
import { IncidentsService } from './incidents.service.js';

export interface MonitorJob {
  kind: 'monitor';
  window: number;
}
@Injectable()
export class ObservabilityMonitorService {
  constructor(
    @Inject(OBSERVABILITY_MONITOR_REPOSITORY)
    private readonly repository: ObservabilityMonitorRepository,
    @Inject(OPERATIONS_DEPENDENCY_PROBES) private readonly probes: OperationsDependencyProbes,
    private readonly incidents: IncidentsService,
    private readonly config: ConfigService<Environment, true>,
    private readonly heartbeat: ObservabilityHeartbeat,
    @Inject(MONITOR_SCHEDULER) private readonly scheduler: MonitorScheduler,
  ) {}
  enabled() {
    return this.config.get('OBSERVABILITY_MONITOR_ENABLED', { infer: true });
  }
  private interval() {
    const interval = this.config.get('OBSERVABILITY_MONITOR_INTERVAL_SECONDS', { infer: true });
    return process.env.VERCEL === '1' ? Math.max(900, interval) : interval;
  }
  currentWindow(now = new Date()) {
    return Math.floor(now.getTime() / (this.interval() * 1000));
  }
  async schedule(window: number): Promise<void> {
    const environment = this.config.get('OBSERVABILITY_ENVIRONMENT', { infer: true });
    await this.scheduler.schedule(environment, this.interval(), window);
  }
  async seed(): Promise<void> {
    if (
      this.enabled() &&
      (await this.repository.enabled(this.config.get('OBSERVABILITY_ENVIRONMENT', { infer: true })))
    )
      await this.schedule(this.currentWindow());
  }
  async process(job: MonitorJob, managed = process.env.VERCEL === '1'): Promise<void> {
    if (!this.enabled()) return;
    if (
      job?.kind !== 'monitor' ||
      !Number.isSafeInteger(job.window) ||
      job.window < 0 ||
      job.window > this.currentWindow() + 1
    )
      throw new Error('INVALID_MONITOR_WINDOW');
    const environment = this.config.get('OBSERVABILITY_ENVIRONMENT', { infer: true });
    if (!(await this.repository.enabled(environment))) return;
    const scan = await this.repository.claim(
      environment,
      job.window,
      new Date(),
      this.config.get('OBSERVABILITY_MONITOR_LEASE_SECONDS', { infer: true }),
    );
    if (scan.kind === 'completed') {
      if (managed && scan.nextWindow !== null) await this.schedule(scan.nextWindow);
      return;
    }
    const claim: MonitorClaim = scan.claim;
    try {
      const [dependencies, backlog] = await Promise.all([
        this.probes.check(),
        this.repository.backlog(
          new Date(),
          this.config.get('OBSERVABILITY_COMMAND_DEADLINE_SECONDS', { infer: true }),
        ),
      ]);
      const enabled = {
        REALTIME_COMMAND: this.config.get('REALTIME_ENABLED', { infer: true }),
        POST_ROOM_KEYWORDS: this.config.get('POST_ROOM_KEYWORDS_ENABLED', { infer: true }),
        SAFETY_CASE: true,
        SAFETY_RESTRICTION: true,
      };
      for (const result of [
        ...dependencies.map((probe) => ({
          ...probe,
          category: 'READINESS' as const,
          reasonCode: probe.reasonCode ?? 'DEPENDENCY_UNAVAILABLE',
        })),
        ...backlog.map((probe) => ({
          ...probe,
          enabled: enabled[probe.component as keyof typeof enabled] ?? false,
        })),
      ]) {
        await this.repository.record(
          claim,
          result,
          this.config.get('OPERATIONS_INCIDENT_FAILURE_THRESHOLD', { infer: true }),
          this.config.get('OPERATIONS_INCIDENT_COOLDOWN_SECONDS', { infer: true }),
          new Date(),
        );
      }
      // Small bounded batch. Lease/fencing keeps parallel legacy delivery safe.
      for (let count = 0; count < 5; count++)
        if (!(await this.incidents.dispatchOne()).handled) break;
      const next = Math.max(job.window + 1, this.currentWindow() + 1);
      const continuing = await this.repository.enabled(environment);
      if (managed && continuing) await this.schedule(next);
      await this.repository.complete(claim, next, new Date());
      if (continuing) await this.heartbeat.completed('monitor');
    } catch (error) {
      await this.repository.release(claim).catch(() => undefined);
      throw error;
    }
  }
  async runOnce(): Promise<void> {
    await this.process({ kind: 'monitor', window: this.currentWindow() }, false);
  }
}
