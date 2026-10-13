import { Inject, Injectable } from '@nestjs/common';
import type { ReportInput } from '../../domain/entities/report.js';
import { normalizeReport } from '../../domain/policies/report.policy.js';
import { REPORT_REPOSITORY, type ReportRepository } from '../../domain/ports/report.repository.js';
import { decodeReportHistoryCursor, encodeReportHistoryCursor } from '../report-history-cursor.js';
@Injectable()
export class ReportsService {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}
  submit(input: { [K in keyof ReportInput]: unknown }) {
    return this.reports.submit(normalizeReport(input));
  }
  async listOwn(reporterUserId: string, query: { limit?: number; cursor?: string }) {
    const page = await this.reports.listOwn({
      reporterUserId,
      limit: query.limit ?? 20,
      cursor: decodeReportHistoryCursor(query.cursor),
    });
    return {
      items: page.items,
      nextCursor: page.nextCursor ? encodeReportHistoryCursor(page.nextCursor) : null,
    };
  }
}
