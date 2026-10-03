import {
  assertMetricWindow,
  incidentFingerprint,
  isPurgeableCategory,
  mergedConnectionDurations,
  metricWindow,
  normalizeDimensions,
  normalizeReason,
  normalizeRecoveryCheckSummary,
  validateRetentionSeconds,
} from '../../src/modules/operations/index.js';

describe('operations and governance policy', () => {
  it('uses deterministic UTC day and Monday week windows', () => {
    expect(metricWindow('DAY', new Date('2026-09-20T23:30:00-07:00'))).toEqual({
      grain: 'DAY',
      start: new Date('2026-09-21T00:00:00.000Z'),
      end: new Date('2026-09-22T00:00:00.000Z'),
    });
    expect(metricWindow('WEEK', new Date('2026-09-23T12:00:00Z')).start).toEqual(
      new Date('2026-09-21T00:00:00.000Z'),
    );
    expect(() =>
      assertMetricWindow({
        grain: 'DAY',
        start: new Date('2026-09-21T01:00:00Z'),
        end: new Date('2026-09-22T01:00:00Z'),
      }),
    ).toThrow('METRIC_WINDOW_INVALID');
  });

  it('normalizes only whitelisted dimensions and stable incident fingerprints', () => {
    expect(normalizeDimensions({ cefr: ' b1 ', nationality: 'cn' })).toEqual({
      key: '{"CEFR":"B1","NATIONALITY":"CN"}',
      value: { CEFR: 'B1', NATIONALITY: 'CN' },
    });
    expect(() => normalizeDimensions({ city: 'Shanghai' })).toThrow('METRIC_DIMENSION_INVALID');
    const base = {
      component: 'POSTGRESQL',
      category: 'READINESS',
      severity: 'HIGH' as const,
      scopeType: 'GLOBAL',
      scopeKey: 'primary',
      ruleVersion: 'v1',
      reasonCode: 'UNAVAILABLE',
    };
    expect(incidentFingerprint(base)).toBe(incidentFingerprint({ ...base, severity: 'WARNING' }));
    expect(incidentFingerprint(base)).not.toBe(
      incidentFingerprint({ ...base, scopeKey: 'replica' }),
    );
  });

  it('keeps protected categories non-purgeable and caps temporary retention at seven days', () => {
    expect(isPurgeableCategory('SHORT_TERM_AI_OUTPUT')).toBe(true);
    for (const category of [
      'ACCOUNT_IDENTITY',
      'USER_PRIVATE_CONTENT',
      'SAFETY_EVIDENCE',
      'ENFORCEMENT_APPEAL',
      'BACKOFFICE_AUDIT',
    ] as const) {
      expect(isPurgeableCategory(category)).toBe(false);
      expect(() => validateRetentionSeconds(category, 1)).toThrow('RETENTION_CATEGORY_PROTECTED');
    }
    expect(() => validateRetentionSeconds('TEMPORARY_SPEECH_CONTENT', 604_801)).toThrow(
      'RETENTION_SECONDS_INVALID',
    );
    expect(() => normalizeReason(' '.repeat(3))).toThrow('OPERATIONS_REASON_INVALID');
  });

  it('allows only content-free recovery invariant summaries', () => {
    expect(normalizeRecoveryCheckSummary({ governance: 'PASSED', migrations: true })).toEqual({
      governance: 'PASSED',
      migrations: true,
    });
    expect(() => normalizeRecoveryCheckSummary({ restoredRow: 'private note' })).toThrow(
      'RECOVERY_CHECK_SUMMARY_INVALID',
    );
  });

  it('merges reconnects and overlapping memberships without double-counting', () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 8, 22, 0, minutes));
    const durations = mergedConnectionDurations(
      [
        { membershipId: 'a', userId: 'u', type: 'joined', occurredAt: at(0) },
        { membershipId: 'a', userId: 'u', type: 'joined', occurredAt: at(1) },
        { membershipId: 'b', userId: 'u', type: 'joined', occurredAt: at(2) },
        { membershipId: 'a', userId: 'u', type: 'left', occurredAt: at(4) },
        { membershipId: 'b', userId: 'u', type: 'aborted', occurredAt: at(6) },
        { membershipId: 'a', userId: 'u', type: 'joined', occurredAt: at(7) },
        { membershipId: 'a', userId: 'u', type: 'left', occurredAt: at(9) },
      ],
      at(10),
    );
    expect(durations.get('u')).toBe(8 * 60_000);
  });
});
