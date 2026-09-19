import type {
  BackofficeRole,
  RoleAssignmentQuery,
  RoleAssignmentView,
  RoleMutationInput,
} from '../entities/backoffice.js';

export const BACKOFFICE_REPOSITORY = Symbol('BACKOFFICE_REPOSITORY');

export interface BackofficeRepository {
  currentRoles(userId: string): Promise<BackofficeRole[]>;
  bootstrap(userId: string): Promise<{ roles: BackofficeRole[]; created: boolean }>;
  mutateRole(input: RoleMutationInput): Promise<RoleAssignmentView>;
  listAssignments(
    actorUserId: string,
    actorRoles: BackofficeRole[],
    query: RoleAssignmentQuery,
    requestId?: string,
  ): Promise<{ items: RoleAssignmentView[]; nextCursor: string | null }>;
}
