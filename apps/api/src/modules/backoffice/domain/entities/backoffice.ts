export const BACKOFFICE_ROLES = [
  'PLATFORM_ADMIN',
  'SAFETY_OFFICER',
  'OPERATIONS_ANALYST',
  'AUDITOR',
] as const;
export type BackofficeRole = (typeof BACKOFFICE_ROLES)[number];

export const BACKOFFICE_PERMISSIONS = [
  'BACKOFFICE_ACCESS',
  'ROLE_ASSIGNMENTS_READ',
  'ROLE_ASSIGNMENTS_MANAGE',
  'AUDIT_EVENTS_READ',
  'SAFETY_CASES_READ_ALL',
  'SAFETY_CASES_WORK',
  'SAFETY_RESTRICTIONS_WORK',
  'SAFETY_APPEALS_WORK',
  'SAFETY_CAPABILITY_INCIDENTS_READ',
  'ACCOUNT_RESTRICTED_RECORD_READ',
  'OPERATIONS_METRICS_READ',
  'OPERATIONS_HEALTH_READ',
  'OPERATIONS_DETAILS_READ',
  'OPERATIONAL_INCIDENTS_READ',
  'OPERATIONAL_INCIDENTS_MANAGE',
  'DATA_GOVERNANCE_READ',
  'DATA_GOVERNANCE_MANAGE',
  'RECOVERY_DRILLS_MANAGE',
] as const;
export type BackofficePermission = (typeof BACKOFFICE_PERMISSIONS)[number];

export const BACKOFFICE_ACTIONS = [
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
export type BackofficeAction = (typeof BACKOFFICE_ACTIONS)[number];
export type BackofficeAuditResult = 'SUCCEEDED' | 'REJECTED';

export interface RoleAssignmentView {
  id: string;
  userId: string;
  role: BackofficeRole;
  active: boolean;
  grantedAt: Date;
  revokedAt: Date | null;
  version: number;
}

export interface RoleMutationInput {
  actorUserId: string;
  actorRoles: BackofficeRole[];
  targetUserId: string;
  role: BackofficeRole;
  action: 'GRANT' | 'REVOKE';
  reason: string;
  clientRequestId: string;
  requestId?: string;
  requestHash: string;
}

export interface RoleAssignmentQuery {
  userId?: string;
  role?: BackofficeRole;
  active?: boolean;
  cursor?: string;
  limit: number;
}

export interface AuditEventView {
  id: string;
  actorType: 'USER' | 'SYSTEM_BOOTSTRAP' | 'SYSTEM_JOB';
  actorUserId: string | null;
  actorRoles: BackofficeRole[];
  action: BackofficeAction;
  targetType: string;
  targetId: string | null;
  role: BackofficeRole | null;
  reason: string | null;
  result: BackofficeAuditResult;
  requestId: string | null;
  occurredAt: Date;
}

export interface AuditEventQuery {
  actorUserId?: string;
  action?: BackofficeAction;
  targetType?: string;
  targetId?: string;
  result?: BackofficeAuditResult;
  from?: Date;
  to?: Date;
  cursor?: string;
  limit: number;
}
