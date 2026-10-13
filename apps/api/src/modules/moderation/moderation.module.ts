import { Module } from '@nestjs/common';
import { ReportsService } from './application/services/reports.service.js';
import { REPORT_REPOSITORY } from './domain/ports/report.repository.js';
import { PrismaReportRepository } from './infrastructure/prisma-report.repository.js';
import { ReportsController } from './presentation/reports.controller.js';
import { PersonalReportsController } from './presentation/personal-reports.controller.js';
@Module({
  providers: [
    ReportsService,
    PrismaReportRepository,
    { provide: REPORT_REPOSITORY, useExisting: PrismaReportRepository },
  ],
  controllers: [ReportsController, PersonalReportsController],
  exports: [ReportsService],
})
export class ModerationModule {}
