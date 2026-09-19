import {
  appealDeadline,
  normalizeSafetyReason,
  restrictionEndsAt,
  validateResolution,
} from '../../src/modules/safety/domain/policies/safety.policy.js';

describe('safety policy', () => {
  const start = new Date('2026-09-14T00:00:00.000Z');

  it.each([
    ['GENERAL', 3],
    ['SERIOUS', 12],
    ['HIGH_RISK', 24],
  ] as const)('maps %s to %i hours', (severity, hours) => {
    expect(restrictionEndsAt(severity, start).getTime() - start.getTime()).toBe(
      hours * 60 * 60 * 1000,
    );
  });

  it('fixes the appeal deadline at 30 minutes', () => {
    expect(appealDeadline(start).getTime() - start.getTime()).toBe(30 * 60 * 1000);
  });

  it('normalizes Unicode reasons by code point length', () => {
    expect(normalizeSafetyReason('  复核通过  ')).toBe('复核通过');
    expect(() => normalizeSafetyReason('😀😀', 1)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    );
  });

  it('requires serious confirmed facts for permanent disable', () => {
    expect(() =>
      validateResolution({
        resolution: 'PERMANENT_DISABLE',
        severity: 'GENERAL',
        factsConfirmed: true,
      }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() =>
      validateResolution({ resolution: 'PERMANENT_DISABLE', severity: 'SERIOUS' }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() =>
      validateResolution({
        resolution: 'PERMANENT_DISABLE',
        severity: 'SERIOUS',
        factsConfirmed: true,
      }),
    ).not.toThrow();
  });

  it('rejects conditional fields on no-action and temporary decisions', () => {
    expect(() => validateResolution({ resolution: 'NO_ACTION', severity: 'GENERAL' })).toThrow();
    expect(() =>
      validateResolution({
        resolution: 'TEMPORARY_RESTRICTION',
        severity: 'GENERAL',
        factsConfirmed: true,
      }),
    ).toThrow();
  });
});
