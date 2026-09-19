import { randomUUID } from 'node:crypto';
import {
  REPORT_CATEGORIES,
  normalizeReport,
  assertReportContext,
  reportRetry,
  type ReportInput,
  type ReportContext,
} from '../../src/modules/moderation/index.js';
const input = (): ReportInput => ({
  roomId: randomUUID(),
  reporterUserId: randomUUID(),
  targetUserId: randomUUID(),
  clientRequestId: randomUUID(),
  category: 'OTHER',
  description: 'test statement',
});
const context = (i: ReportInput): ReportContext => ({
  roomId: i.roomId,
  reporter: { userId: i.reporterUserId, joinedAt: new Date(0) },
  target: { userId: i.targetUserId, joinedAt: new Date(1000) },
});
describe('report policy', () => {
  it.each(REPORT_CATEGORIES)('normalizes UUIDs and preserves valid category %s', (category) => {
    const i = input();
    expect(
      normalizeReport({
        ...i,
        roomId: i.roomId.toUpperCase(),
        category,
        description: '  文本 😀  ',
      }),
    ).toEqual({ ...i, category, description: '文本 😀' });
  });
  it.each([null, 4, {}, '', '   ', '\n\t', '😀'.repeat(2001)])(
    'rejects invalid description case %#',
    (description) => {
      expect(() => normalizeReport({ ...input(), description })).toThrow(
        expect.objectContaining({ code: 'VALIDATION_FAILED' }),
      );
    },
  );
  it('counts Unicode code points and keeps internal whitespace', () => {
    expect([
      ...normalizeReport({ ...input(), description: '  ' + '😀'.repeat(2000) + '  ' }).description,
    ]).toHaveLength(2000);
    expect(normalizeReport({ ...input(), description: ' a  b\nc ' }).description).toBe('a  b\nc');
    for (const category of ['FAKE', '', null, 1])
      expect(() => normalizeReport({ ...input(), category })).toThrow();
    expect(() => normalizeReport({ ...input(), roomId: 'not-uuid' })).toThrow();
  });
  it('uses historical joined facts without lifecycle, role, presence or time overlap', () => {
    const i = input();
    expect(() => assertReportContext(i, context(i))).not.toThrow();
    const c = context(i);
    expect(() =>
      assertReportContext(i, { ...c, reporter: { userId: i.reporterUserId, joinedAt: null } }),
    ).toThrow(expect.objectContaining({ code: 'REPORT_CONTEXT_NOT_FOUND' }));
    expect(() =>
      assertReportContext(i, { ...c, target: { userId: i.targetUserId, joinedAt: null } }),
    ).toThrow(expect.objectContaining({ code: 'REPORT_CONTEXT_NOT_FOUND' }));
    expect(() => assertReportContext(i, { ...c, roomId: randomUUID() })).toThrow();
    expect(() => assertReportContext(i, null)).toThrow();
  });
  it('checks reporter context before disclosing self or target information', () => {
    const i = input();
    i.targetUserId = i.reporterUserId;
    expect(() => assertReportContext(i, null)).toThrow(
      expect.objectContaining({ code: 'REPORT_CONTEXT_NOT_FOUND' }),
    );
    expect(() => assertReportContext(i, context(i))).toThrow(
      expect.objectContaining({ code: 'REPORT_TARGET_INVALID' }),
    );
  });
  it('retries normalized content and detects every bound field change including reporter isolation', () => {
    const i = input(),
      stored = {
        ...i,
        id: randomUUID(),
        submittedAt: new Date(),
        safetyCase: { id: randomUUID() },
      };
    expect(
      reportRetry(normalizeReport({ ...i, description: `  ${i.description}  ` }), stored),
    ).toEqual({ id: stored.id, caseId: stored.safetyCase.id, submittedAt: stored.submittedAt });
    for (const patch of [
      { roomId: randomUUID() },
      { reporterUserId: randomUUID() },
      { targetUserId: randomUUID() },
      { clientRequestId: randomUUID() },
      { category: 'SPAM_ADVERTISING' as const },
      { description: 'changed' },
    ])
      expect(() => reportRetry({ ...i, ...patch }, stored)).toThrow(
        expect.objectContaining({ code: 'REPORT_REQUEST_CONFLICT' }),
      );
  });
});
