import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../../../common/errors/app-error.js';
import type {
  BackofficeAuditQuery,
  BackofficeAuditRole,
} from '../../domain/entities/backoffice-audit.js';
import {
  BACKOFFICE_AUDIT_REPOSITORY,
  type BackofficeAuditRepository,
} from '../../domain/ports/backoffice-audit.repository.js';
@Injectable()
export class BackofficeAuditService {
  constructor(
    @Inject(BACKOFFICE_AUDIT_REPOSITORY) private readonly repository: BackofficeAuditRepository,
  ) {}
  list(
    actorUserId: string,
    actorRoles: BackofficeAuditRole[],
    query: BackofficeAuditQuery,
    requestId?: string,
  ) {
    if (query.from && query.to && query.from > query.to)
      throw new AppError('VALIDATION_FAILED', 'Request validation failed', 400);
    return this.repository.list(actorUserId, actorRoles, query, requestId);
  }
}
