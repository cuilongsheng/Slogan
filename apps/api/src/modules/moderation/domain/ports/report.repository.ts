import type { ReportInput, ReportReceipt } from '../entities/report.js';
import type { PersonalReport, ReportHistoryCursor } from '../entities/report-history.js';
export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');
export interface ReportRepository {
  submit(input: ReportInput): Promise<ReportReceipt>;
  listOwn(input: {
    reporterUserId: string;
    limit: number;
    cursor: ReportHistoryCursor | null;
  }): Promise<{ items: PersonalReport[]; nextCursor: ReportHistoryCursor | null }>;
}
