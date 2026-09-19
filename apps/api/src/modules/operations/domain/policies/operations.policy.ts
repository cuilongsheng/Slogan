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
  const allowed: MetricDimension[] = ['NATIONALITY', 'CEFR'];
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
