import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/index.js';
import { BackofficeService } from './application/services/backoffice.service.js';
import { BackofficeBootstrapCommand } from './application/services/backoffice-bootstrap.command.js';
import { BACKOFFICE_REPOSITORY } from './domain/ports/backoffice.repository.js';
import { PrismaBackofficeRepository } from './infrastructure/prisma-backoffice.repository.js';
import { BackofficeController } from './presentation/backoffice.controller.js';
import { BackofficePermissionGuard } from './presentation/backoffice-permission.guard.js';

@Module({
  imports: [AuditModule],
  controllers: [BackofficeController],
  providers: [
    BackofficeService,
    BackofficeBootstrapCommand,
    BackofficePermissionGuard,
    PrismaBackofficeRepository,
    { provide: BACKOFFICE_REPOSITORY, useExisting: PrismaBackofficeRepository },
  ],
  exports: [BackofficeService, BackofficeBootstrapCommand, BackofficePermissionGuard],
})
export class BackofficeModule {}
