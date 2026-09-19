export { BackofficeModule } from './backoffice.module.js';
export { BackofficeService } from './application/services/backoffice.service.js';
export { BackofficeBootstrapCommand } from './application/services/backoffice-bootstrap.command.js';
export { BackofficeError } from './domain/errors/backoffice.error.js';
export { BACKOFFICE_ROLES } from './domain/entities/backoffice.js';
export type { BackofficeRole, BackofficePermission } from './domain/entities/backoffice.js';
export {
  hasBackofficePermission,
  normalizeBackofficeReason,
  roleCommandContent,
  sortBackofficeRoles,
  wouldRemoveLastPlatformAdmin,
} from './domain/policies/backoffice.policy.js';
export { lockPlatformAdminSet } from './persistence.js';
export { BackofficePermissionGuard } from './presentation/backoffice-permission.guard.js';
export type { BackofficeRequest } from './presentation/backoffice-permission.guard.js';
export { RequireBackofficePermission } from './presentation/backoffice-permission.decorator.js';
