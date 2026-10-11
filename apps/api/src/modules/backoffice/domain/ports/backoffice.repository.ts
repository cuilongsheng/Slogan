import type {
  BackofficeRole,
  PublicRoomSummary,
  RoleAssignmentQuery,
  RoleAssignmentView,
  RoleMutationInput,
} from '../entities/backoffice.js';

export const BACKOFFICE_REPOSITORY = Symbol('BACKOFFICE_REPOSITORY');

export interface BackofficeRepository {
  publicRooms(
    limit: number,
    cursor?: string,
  ): Promise<{
    items: PublicRoomSummary[];
    nextCursor: string | null;
    openCount: number;
    scheduledCount: number;
  }>;
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
