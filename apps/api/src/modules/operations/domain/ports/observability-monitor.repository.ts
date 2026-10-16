export interface MonitorClaim {
  environment: string;
  window: number;
  leaseId: string;
  generation: number;
}
export interface MonitorProbe {
  component: string;
  category: 'READINESS' | 'BACKLOG';
  enabled: boolean;
  ready: boolean;
  reasonCode: string;
  unknown?: boolean;
}
export type MonitorScan =
  { kind: 'claimed'; claim: MonitorClaim } | { kind: 'completed'; nextWindow: number | null };
export const OBSERVABILITY_MONITOR_REPOSITORY = Symbol('OBSERVABILITY_MONITOR_REPOSITORY');
export interface ObservabilityMonitorRepository {
  claim(environment: string, window: number, now: Date, leaseSeconds: number): Promise<MonitorScan>;
  record(
    claim: MonitorClaim,
    probe: MonitorProbe,
    threshold: number,
    cooldownSeconds: number,
    now: Date,
  ): Promise<void>;
  complete(claim: MonitorClaim, nextWindow: number, now: Date): Promise<void>;
  release(claim: MonitorClaim): Promise<void>;
  backlog(now: Date, deadlineSeconds: number): Promise<MonitorProbe[]>;
}
