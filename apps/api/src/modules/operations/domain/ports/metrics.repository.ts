import type { BackofficeRole } from '../../../backoffice/index.js';
import type {
  MetricFact,
  MetricSnapshotQuery,
  MetricSnapshotView,
  MetricWindow,
  RoomOperationsQuery,
} from '../entities/operations.js';

export const METRICS_REPOSITORY = Symbol('METRICS_REPOSITORY');

export interface MetricRunClaim {
  runId: string;
  leaseId: string;
  generation: number;
  window: MetricWindow;
  definitionVersion: string;
}

export interface MetricsRepository {
  claim(
    window: MetricWindow,
    definitionVersion: string,
    leaseSeconds: number,
  ): Promise<MetricRunClaim>;
  compute(window: MetricWindow, now: Date): Promise<MetricFact[]>;
  commit(claim: MetricRunClaim, facts: MetricFact[], dataThroughAt: Date): Promise<void>;
  fail(claim: MetricRunClaim, errorCode: string): Promise<void>;
  list(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: MetricSnapshotQuery,
    requestId?: string,
  ): Promise<{ items: MetricSnapshotView[]; nextCursor: string | null }>;
  currentOnline(): Promise<{ value: number | null; sampledAt: Date; reasonCode?: string }>;
  rooms(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: RoomOperationsQuery,
    requestId?: string,
  ): Promise<{ items: Record<string, unknown>[]; nextCursor: string | null }>;
  activeUsers(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    from: Date,
    to: Date,
    cursor: string | undefined,
    limit: number,
    requestId?: string,
  ): Promise<{ items: Record<string, unknown>[]; nextCursor: string | null }>;
}
