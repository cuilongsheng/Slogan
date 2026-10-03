import { createHash } from 'node:crypto';
import type {
  IncidentObservationInput,
  MetricDimension,
  MetricGrain,
  MetricWindow,
  RetentionCategory,
} from '../entities/operations.js';

const DAY = 86_400_000;
const PURGEABLE: readonly RetentionCategory[] = [
  'TEMPORARY_SPEECH_CONTENT',
  'SHORT_TERM_AI_OUTPUT',
  'TEMPORARY_COORDINATION',
  'TECHNICAL_COMMAND',
  'OPERATIONS_METRIC',
];

export function metricWindow(grain: MetricGrain, instant: Date): MetricWindow {
  const date = new Date(instant);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (grain === 'WEEK') {
    const mondayOffset = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - mondayOffset);
  }
  const end = new Date(start.getTime() + (grain === 'DAY' ? DAY : 7 * DAY));
  return { grain, start, end };
}

export function assertMetricWindow(window: MetricWindow, now = new Date()): void {
  const expected = metricWindow(window.grain, window.start);
  if (
    expected.start.getTime() !== window.start.getTime() ||
    expected.end.getTime() !== window.end.getTime() ||
    window.end > now
  )
    throw new Error('METRIC_WINDOW_INVALID');
}

export function normalizeDimensions(dimensions: Record<string, string>): {
  key: string;
  value: Record<string, string>;
} {
  const entries = Object.entries(dimensions)
    .map(([key, value]) => [key.trim().toUpperCase(), value.trim().toUpperCase()] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const allowed: MetricDimension[] = ['NATIONALITY', 'CEFR', 'ROOM_TYPE', 'RESULT'];
  if (
    entries.some(([key, value]) => !allowed.includes(key as MetricDimension) || value.length < 1) ||
    new Set(entries.map(([key]) => key)).size !== entries.length
  )
    throw new Error('METRIC_DIMENSION_INVALID');
  const value = Object.fromEntries(entries);
  return { key: JSON.stringify(value), value };
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function normalizeReason(value: string): string {
  const reason = value.trim();
  if ([...reason].length < 1 || [...reason].length > 500)
    throw new Error('OPERATIONS_REASON_INVALID');
  return reason;
}

export function incidentFingerprint(input: Omit<IncidentObservationInput, 'observedAt'>): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        component: input.component,
        category: input.category,
        scopeType: input.scopeType,
        scopeKey: input.scopeKey,
        ruleVersion: input.ruleVersion,
      }),
    )
    .digest('hex');
}

export function isPurgeableCategory(category: RetentionCategory): boolean {
  return PURGEABLE.includes(category);
}

export function validateRetentionSeconds(
  category: RetentionCategory,
  retentionSeconds: number | null,
): void {
  if (!isPurgeableCategory(category)) throw new Error('RETENTION_CATEGORY_PROTECTED');
  if (retentionSeconds === null || retentionSeconds < 0)
    throw new Error('RETENTION_SECONDS_INVALID');
  if (
    ['TEMPORARY_SPEECH_CONTENT', 'SHORT_TERM_AI_OUTPUT', 'TEMPORARY_COORDINATION'].includes(
      category,
    ) &&
    retentionSeconds > 604_800
  )
    throw new Error('RETENTION_SECONDS_INVALID');
}

export function commandHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function mergedConnectionDurations(
  events: Array<{
    membershipId: string;
    userId: string;
    type: string;
    occurredAt: Date;
  }>,
  windowEnd: Date,
): Map<string, number> {
  const starts = new Map<string, Date>();
  const intervals = new Map<string, Array<{ start: Date; end: Date }>>();
  const append = (userId: string, start: Date, end: Date) => {
    if (end <= start) return;
    const rows = intervals.get(userId) ?? [];
    rows.push({ start, end });
    intervals.set(userId, rows);
  };
  for (const event of events) {
    if (event.type === 'joined') {
      if (!starts.has(event.membershipId)) starts.set(event.membershipId, event.occurredAt);
      continue;
    }
    const start = starts.get(event.membershipId);
    if (!start) continue;
    append(event.userId, start, event.occurredAt);
    starts.delete(event.membershipId);
  }
  for (const [membershipId, start] of starts) {
    const userId = events.find((item) => item.membershipId === membershipId)?.userId;
    if (userId) append(userId, start, windowEnd);
  }
  const totals = new Map<string, number>();
  for (const [userId, rows] of intervals) {
    const ordered = rows.sort(
      (left, right) =>
        left.start.getTime() - right.start.getTime() || left.end.getTime() - right.end.getTime(),
    );
    let current = ordered[0];
    let total = 0;
    for (const interval of ordered.slice(1)) {
      if (interval.start <= current!.end) {
        if (interval.end > current!.end) current = { start: current!.start, end: interval.end };
        continue;
      }
      total += current!.end.getTime() - current!.start.getTime();
      current = interval;
    }
    if (current) total += current.end.getTime() - current.start.getTime();
    totals.set(userId, total);
  }
  return totals;
}

const RECOVERY_CHECK_KEYS = new Set([
  'migrations',
  'identity_ownership',
  'room_membership',
  'reservations',
  'safety',
  'roles',
  'private_content',
  'commands',
  'governance',
]);

export function normalizeRecoveryCheckSummary(
  value: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  if (
    entries.length < 1 ||
    entries.some(
      ([key, result]) =>
        !RECOVERY_CHECK_KEYS.has(key) ||
        (typeof result === 'string' && !['PASSED', 'FAILED', 'SKIPPED'].includes(result)) ||
        (typeof result === 'number' && (!Number.isInteger(result) || result < 0)),
    )
  )
    throw new Error('RECOVERY_CHECK_SUMMARY_INVALID');
  return Object.fromEntries(entries);
}
