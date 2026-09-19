import { SetMetadata } from '@nestjs/common';
import type { BackofficePermission } from '../domain/entities/backoffice.js';

export const BACKOFFICE_PERMISSION = 'backoffice_permission';
export const RequireBackofficePermission = (permission: BackofficePermission) =>
  SetMetadata(BACKOFFICE_PERMISSION, permission);
