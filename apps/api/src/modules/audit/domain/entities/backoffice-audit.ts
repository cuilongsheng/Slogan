export type BackofficeAuditRole =
  'PLATFORM_ADMIN' | 'SAFETY_OFFICER' | 'OPERATIONS_ANALYST' | 'AUDITOR';
export const BACKOFFICE_AUDIT_ACTIONS = [
  'BACKOFFICE_BOOTSTRAPPED',
  'ROLE_GRANTED',
  'ROLE_REVOKED',
  'ROLE_ASSIGNMENTS_VIEWED',
  'AUDIT_EVENTS_VIEWED',
  'SAFETY_CASES_VIEWED',
  'SAFETY_CASE_CREATED',
  'SAFETY_CASE_VIEWED',
  'SAFETY_EVIDENCE_VIEWED',
  'SAFETY_CASE_ASSIGNED',
  'SAFETY_CASE_CLAIMED',
  'SAFETY_REVIEW_STARTED',
  'SAFETY_CASE_RESOLVED',
  'SAFETY_CASE_DISMISSED',
  'SAFETY_RESTRICTIONS_VIEWED',
  'SAFETY_RESTRICTION_CREATED',
  'SAFETY_RESTRICTION_EXPIRED',
  'SAFETY_RESTRICTION_LIFTED',
  'SAFETY_APPEALS_VIEWED',
  'SAFETY_APPEAL_SUBMITTED',
  'SAFETY_APPEAL_DECIDED',
  'SAFETY_ACCOUNT_DISABLED',
  'SAFETY_CAPABILITY_INCIDENTS_VIEWED',
  'ACCOUNT_RESTRICTED_RECORD_VIEWED',
  'ACCOUNT_RESTRICTED_RECORD_REJECTED',
  'ACCOUNT_DELETED',
  'OPERATIONS_METRICS_VIEWED',
  'OPERATIONS_DETAILS_VIEWED',
  'OPERATIONAL_INCIDENTS_VIEWED',
  'OPERATIONAL_INCIDENT_ACKNOWLEDGED',
  'OPERATIONAL_INCIDENT_RESOLVED',
  'RETENTION_POLICIES_VIEWED',
  'RETENTION_DRY_RUNS_VIEWED',
  'RETENTION_HOLDS_VIEWED',
  'RETENTION_RUNS_VIEWED',
  'DELETION_EVIDENCE_VIEWED',
  'RETENTION_POLICY_CREATED',
  'RETENTION_POLICY_ACTIVATED',
  'RETENTION_DRY_RUN_CREATED',
  'RETENTION_HOLD_CREATED',
  'RETENTION_HOLD_RELEASED',
  'RETENTION_RUN_CREATED',
  'RETENTION_RUN_COMPLETED',
  'RECOVERY_DRILLS_VIEWED',
  'RECOVERY_DRILL_RECORDED',
  'OPERATIONS_ACCESS_REJECTED',
] as const;
export type BackofficeAuditAction = (typeof BACKOFFICE_AUDIT_ACTIONS)[number];
export type BackofficeAuditResult = 'SUCCEEDED' | 'REJECTED';
export interface BackofficeAuditEventView {
  id: string;
  actorType: 'USER' | 'SYSTEM_BOOTSTRAP' | 'SYSTEM_JOB';
  actorUserId: string | null;
  actorRoles: BackofficeAuditRole[];
  action: BackofficeAuditAction;
  targetType: string;
  targetId: string | null;
  role: BackofficeAuditRole | null;
  reason: string | null;
  result: BackofficeAuditResult;
  requestId: string | null;
  occurredAt: Date;
}
export interface BackofficeAuditQuery {
  actorUserId?: string;
  action?: BackofficeAuditAction;
  targetType?: string;
  targetId?: string;
  result?: BackofficeAuditResult;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}

export interface BackofficeAuditAppendInput {
  actorType: 'USER' | 'SYSTEM_BOOTSTRAP' | 'SYSTEM_JOB';
  actorUserId?: string;
  actorRoles: BackofficeAuditRole[];
  action: BackofficeAuditAction;
  targetType: string;
  targetId?: string;
  role?: BackofficeAuditRole;
  reason?: string;
  result: BackofficeAuditResult;
  clientRequestId?: string;
  requestHash?: string;
  requestId?: string;
  details?: Record<string, string | number | boolean | null>;
}
