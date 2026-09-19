import {
  REPORT_CATEGORIES,
  type ReportCategory,
  type ReportContext,
  type ReportInput,
  type ReportRecord,
} from '../entities/report.js';
import { ReportError } from '../errors/report.error.js';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function reportUuid(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value)) throw new ReportError('VALIDATION_FAILED');
  return value.toLowerCase();
}
export function reportDescription(value: unknown): string {
  if (typeof value !== 'string') throw new ReportError('VALIDATION_FAILED');
  const normalized = value.trim();
  if (!normalized || [...normalized].length > 2000) throw new ReportError('VALIDATION_FAILED');
  return normalized;
}
export function normalizeReport(input: { [K in keyof ReportInput]: unknown }): ReportInput {
  if (!REPORT_CATEGORIES.includes(input.category as ReportCategory))
    throw new ReportError('VALIDATION_FAILED');
  return {
    roomId: reportUuid(input.roomId),
    reporterUserId: reportUuid(input.reporterUserId),
    targetUserId: reportUuid(input.targetUserId),
    clientRequestId: reportUuid(input.clientRequestId),
    category: input.category as ReportCategory,
    description: reportDescription(input.description),
  };
}
export function assertReportContext(input: ReportInput, context: ReportContext | null) {
  if (
    !context ||
    context.roomId !== input.roomId ||
    context.reporter?.userId !== input.reporterUserId ||
    !context.reporter.joinedAt
  )
    throw new ReportError('REPORT_CONTEXT_NOT_FOUND');
  if (input.reporterUserId === input.targetUserId) throw new ReportError('REPORT_TARGET_INVALID');
  if (context.target?.userId !== input.targetUserId || !context.target.joinedAt)
    throw new ReportError('REPORT_CONTEXT_NOT_FOUND');
}
export function reportRetry(input: ReportInput, stored: ReportRecord) {
  if (
    stored.reporterUserId !== input.reporterUserId ||
    stored.clientRequestId !== input.clientRequestId ||
    stored.roomId !== input.roomId ||
    stored.targetUserId !== input.targetUserId ||
    stored.category !== input.category ||
    stored.description !== input.description
  )
    throw new ReportError('REPORT_REQUEST_CONFLICT');
  if (!stored.safetyCase) throw new Error('Accepted report has no safety case');
  return { id: stored.id, caseId: stored.safetyCase.id, submittedAt: stored.submittedAt };
}
