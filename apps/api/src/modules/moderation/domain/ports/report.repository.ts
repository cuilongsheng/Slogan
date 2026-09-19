import type { ReportInput, ReportReceipt } from '../entities/report.js';
export const REPORT_REPOSITORY = Symbol('REPORT_REPOSITORY');
export interface ReportRepository {
  submit(input: ReportInput): Promise<ReportReceipt>;
}
