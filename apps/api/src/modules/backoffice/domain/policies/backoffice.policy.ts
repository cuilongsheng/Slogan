import type { BackofficePermission, BackofficeRole } from '../entities/backoffice.js';

const permissions: Record<BackofficeRole, readonly BackofficePermission[]> = {
  PLATFORM_ADMIN: [
    'BACKOFFICE_ACCESS',
    'ROLE_ASSIGNMENTS_READ',
    'ROLE_ASSIGNMENTS_MANAGE',
    'AUDIT_EVENTS_READ',
    'SAFETY_CASES_READ_ALL',
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
  ],
  SAFETY_OFFICER: [
    'BACKOFFICE_ACCESS',
    'SAFETY_CASES_WORK',
    'SAFETY_RESTRICTIONS_WORK',
    'SAFETY_APPEALS_WORK',
    'SAFETY_CAPABILITY_INCIDENTS_READ',
    'ACCOUNT_RESTRICTED_RECORD_READ',
  ],
  OPERATIONS_ANALYST: ['BACKOFFICE_ACCESS', 'OPERATIONS_METRICS_READ', 'OPERATIONS_HEALTH_READ'],
  AUDITOR: [
    'BACKOFFICE_ACCESS',
    'AUDIT_EVENTS_READ',
    'SAFETY_CAPABILITY_INCIDENTS_READ',
    'OPERATIONAL_INCIDENTS_READ',
    'DATA_GOVERNANCE_READ',
  ],
};

export function hasBackofficePermission(
  roles: readonly BackofficeRole[],
  permission: BackofficePermission,
): boolean {
  return roles.some((role) => permissions[role].includes(permission));
}

export function sortBackofficeRoles(roles: readonly BackofficeRole[]): BackofficeRole[] {
  const order: BackofficeRole[] = [
    'PLATFORM_ADMIN',
    'SAFETY_OFFICER',
    'OPERATIONS_ANALYST',
    'AUDITOR',
  ];
  return [...new Set(roles)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function normalizeBackofficeReason(value: string): string {
  const reason = value.trim();
  const length = [...reason].length;
  if (length < 1 || length > 500) throw new Error('BACKOFFICE_REASON_INVALID');
  return reason;
}

export function roleCommandContent(input: {
  action: 'GRANT' | 'REVOKE';
  targetUserId: string;
  role: BackofficeRole;
  reason: string;
}): string {
  return JSON.stringify({ ...input, reason: normalizeBackofficeReason(input.reason) });
}

export function wouldRemoveLastPlatformAdmin(
  activeAdminCount: number,
  targetRoleIsActive: boolean,
): boolean {
  return targetRoleIsActive && activeAdminCount <= 1;
}
