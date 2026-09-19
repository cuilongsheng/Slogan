import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type ReportCategory as DatabaseCategory,
} from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { readReportingContext } from '../../rooms/persistence.js';
import { appendRoomEvent } from '../../audit/persistence.js';
import { createSafetyCaseForReport } from '../../safety/persistence.js';
import type { ReportCategory, ReportInput } from '../domain/entities/report.js';
import type { ReportRepository } from '../domain/ports/report.repository.js';
import { assertReportContext, reportRetry } from '../domain/policies/report.policy.js';
const categories: Record<ReportCategory, DatabaseCategory> = {
  HARASSMENT_ABUSE: 'HARASSMENT_ABUSE',
  HATE_DISCRIMINATION: 'HATE_DISCRIMINATION',
  SEXUAL_CONTENT: 'SEXUAL_CONTENT',
  SPAM_ADVERTISING: 'SPAM_ADVERTISING',
  OTHER: 'OTHER',
};
@Injectable()
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly prisma: PrismaService) {}
  async submit(input: ReportInput) {
    const key = {
      reporterUserId_clientRequestId: {
        reporterUserId: input.reporterUserId,
        clientRequestId: input.clientRequestId,
      },
    };
    const existing = await this.prisma.report.findUnique({
      where: key,
      include: { safetyCase: { select: { id: true } } },
    });
    if (existing) return reportRetry(input, existing);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const context = await readReportingContext(
          tx,
          input.roomId,
          input.reporterUserId,
          input.targetUserId,
        );
        assertReportContext(input, context);
        const report = await tx.report.create({
          data: { ...input, id: randomUUID(), category: categories[input.category] },
        });
        const written = await appendRoomEvent(tx, {
          roomId: input.roomId,
          reportId: report.id,
          type: 'report_submitted',
          source: 'http',
          actorId: input.reporterUserId,
          targetId: input.targetUserId,
          reason: input.category,
          result: 'SUBMITTED',
          occurredAt: report.submittedAt,
        });
        if (!written) throw new Error('Report audit was not persisted');
        const caseId = await createSafetyCaseForReport(tx, {
          reportId: report.id,
          roomId: report.roomId,
          targetUserId: report.targetUserId,
          submittedAt: report.submittedAt,
        });
        return { id: report.id, caseId, submittedAt: report.submittedAt };
      });
    } catch (error) {
      // Re-read only AFTER Prisma has rolled back the failed PostgreSQL transaction.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const stored = await this.prisma.report.findUnique({
          where: key,
          include: { safetyCase: { select: { id: true } } },
        });
        if (stored) return reportRetry(input, stored);
      }
      throw error;
    }
  }
}
