import { Inject, Injectable } from '@nestjs/common';
import type { ReportInput } from '../../domain/entities/report.js';
import { normalizeReport } from '../../domain/policies/report.policy.js';
import { REPORT_REPOSITORY, type ReportRepository } from '../../domain/ports/report.repository.js';
@Injectable()
export class ReportsService {
  constructor(@Inject(REPORT_REPOSITORY) private readonly reports: ReportRepository) {}
  submit(input: { [K in keyof ReportInput]: unknown }) {
    return this.reports.submit(normalizeReport(input));
  }
}
