import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../common/errors/app-error.js';
import type {
  BackofficePermission,
  BackofficeRole,
  RoleAssignmentQuery,
} from '../../domain/entities/backoffice.js';
import { BackofficeError } from '../../domain/errors/backoffice.error.js';
import {
  BACKOFFICE_REPOSITORY,
  type BackofficeRepository,
} from '../../domain/ports/backoffice.repository.js';
import {
  hasBackofficePermission,
  normalizeBackofficeReason,
  roleCommandContent,
} from '../../domain/policies/backoffice.policy.js';

@Injectable()
export class BackofficeService {
  constructor(@Inject(BACKOFFICE_REPOSITORY) private readonly repository: BackofficeRepository) {}

  async roles(userId: string): Promise<BackofficeRole[]> {
    return this.repository.currentRoles(userId);
  }

  async authorize(userId: string, permission: BackofficePermission): Promise<BackofficeRole[]> {
    const roles = await this.roles(userId);
    if (!hasBackofficePermission(roles, permission)) throw BackofficeError.denied();
    return roles;
  }

  bootstrap(userId: string) {
    return this.repository.bootstrap(userId);
  }

  async mutateRole(input: {
    actorUserId: string;
    targetUserId: string;
    role: BackofficeRole;
    action: 'GRANT' | 'REVOKE';
    reason: string;
    clientRequestId: string;
    requestId?: string;
  }) {
    const actorRoles = await this.authorize(input.actorUserId, 'ROLE_ASSIGNMENTS_MANAGE');
    let reason: string;
    try {
      reason = normalizeBackofficeReason(input.reason);
    } catch {
      throw new AppError('VALIDATION_FAILED', 'Request validation failed', 400);
    }
    const content = roleCommandContent({
      action: input.action,
      targetUserId: input.targetUserId,
      role: input.role,
      reason,
    });
    return this.repository.mutateRole({
      ...input,
      actorRoles,
      reason,
      requestHash: createHash('sha256').update(content).digest('hex'),
    });
  }

  async listAssignments(actorUserId: string, query: RoleAssignmentQuery, requestId?: string) {
    const roles = await this.authorize(actorUserId, 'ROLE_ASSIGNMENTS_READ');
    return this.repository.listAssignments(actorUserId, roles, query, requestId);
  }
}
