export { ModerationModule } from './moderation.module.js';
export { ReportsService } from './application/services/reports.service.js';
export { REPORT_REPOSITORY } from './domain/ports/report.repository.js';
export type { ReportRepository } from './domain/ports/report.repository.js';
export { REPORT_CATEGORIES } from './domain/entities/report.js';
export type { ReportInput, ReportRecord, ReportContext } from './domain/entities/report.js';
export {
  normalizeReport,
  assertReportContext,
  reportRetry,
} from './domain/policies/report.policy.js';
