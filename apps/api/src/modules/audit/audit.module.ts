import { Module } from '@nestjs/common';
import { BackofficeAuditService } from './application/services/backoffice-audit.service.js';
import { BACKOFFICE_AUDIT_REPOSITORY } from './domain/ports/backoffice-audit.repository.js';
import { PrismaBackofficeAuditRepository } from './infrastructure/prisma-backoffice-audit.repository.js';
@Module({
  providers: [
    BackofficeAuditService,
    PrismaBackofficeAuditRepository,
    { provide: BACKOFFICE_AUDIT_REPOSITORY, useExisting: PrismaBackofficeAuditRepository },
  ],
  exports: [BackofficeAuditService],
})
export class AuditModule {}
