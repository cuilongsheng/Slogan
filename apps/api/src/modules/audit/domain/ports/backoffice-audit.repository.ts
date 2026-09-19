import type {
  BackofficeAuditEventView,
  BackofficeAuditQuery,
  BackofficeAuditRole,
} from '../entities/backoffice-audit.js';
export const BACKOFFICE_AUDIT_REPOSITORY = Symbol('BACKOFFICE_AUDIT_REPOSITORY');
export interface BackofficeAuditRepository {
  list(
    actorUserId: string,
    actorRoles: BackofficeAuditRole[],
    query: BackofficeAuditQuery,
    requestId?: string,
  ): Promise<{ items: BackofficeAuditEventView[]; nextCursor: string | null }>;
}
