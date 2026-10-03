import type { BackofficeRole } from '../../../backoffice/index.js';
import type {
  IncidentObservationInput,
  IncidentQuery,
  IncidentView,
} from '../entities/operations.js';

export const INCIDENTS_REPOSITORY = Symbol('INCIDENTS_REPOSITORY');

export interface IncidentCommandInput {
  actorUserId: string;
  actorRoles: BackofficeRole[];
  incidentId: string;
  action: 'ACKNOWLEDGE' | 'RESOLVE';
  reason: string;
  clientRequestId: string;
  payloadHash: string;
  requestId?: string;
  now: Date;
}

export interface AlertDeliveryClaim {
  id: string;
  incidentId: string;
  leaseId: string;
  generation: number;
  payload: {
    status: string;
    component: string;
    category: string;
    severity: string;
    scopeType: string;
    reasonCode: string;
    firstObservedAt: string;
  };
}

export interface IncidentsRepository {
  observe(input: IncidentObservationInput, cooldownSeconds: number): Promise<IncidentView>;
  recover(input: Omit<IncidentObservationInput, 'severity' | 'reasonCode'>): Promise<boolean>;
  list(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: IncidentQuery,
    requestId?: string,
  ): Promise<{ items: IncidentView[]; nextCursor: string | null }>;
  detail(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    incidentId: string,
    requestId?: string,
  ): Promise<IncidentView | null>;
  command(input: IncidentCommandInput): Promise<IncidentView>;
  trends(
    from: Date,
    to: Date,
  ): Promise<Array<{ component: string; severity: string; count: number }>>;
  claimDelivery(leaseSeconds: number, now: Date): Promise<AlertDeliveryClaim | null>;
  completeDelivery(claim: AlertDeliveryClaim, now: Date): Promise<void>;
  failDelivery(claim: AlertDeliveryClaim, errorCode: string, retryAt: Date): Promise<void>;
}

export const OPERATIONAL_ALERT_SINK = Symbol('OPERATIONAL_ALERT_SINK');
export interface OperationalAlertSink {
  send(payload: AlertDeliveryClaim['payload']): Promise<void>;
}
