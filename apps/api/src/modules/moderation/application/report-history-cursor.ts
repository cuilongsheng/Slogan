import type { ReportHistoryCursor } from '../domain/entities/report-history.js';
import { ReportError } from '../domain/errors/report.error.js';

export function encodeReportHistoryCursor(cursor: ReportHistoryCursor): string {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      kind: 'personal-reports',
      submittedAt: cursor.submittedAt.toISOString(),
      id: cursor.id,
    }),
  ).toString('base64url');
}
export function decodeReportHistoryCursor(value?: string): ReportHistoryCursor | null {
  if (value === undefined) return null;
  try {
    const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    if (
      data.v !== 1 ||
      data.kind !== 'personal-reports' ||
      typeof data.submittedAt !== 'string' ||
      typeof data.id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)
    )
      throw new Error('invalid');
    const submittedAt = new Date(data.submittedAt);
    if (!Number.isFinite(submittedAt.getTime()) || submittedAt.toISOString() !== data.submittedAt)
      throw new Error('invalid');
    return { submittedAt, id: data.id };
  } catch {
    throw new ReportError('VALIDATION_FAILED');
  }
}
