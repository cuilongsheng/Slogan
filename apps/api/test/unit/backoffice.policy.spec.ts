import {
  hasBackofficePermission,
  normalizeBackofficeReason,
  roleCommandContent,
  sortBackofficeRoles,
  wouldRemoveLastPlatformAdmin,
} from '../../src/modules/backoffice/index.js';

describe('backoffice policy', () => {
  it('keeps role capabilities independent and combines multiple roles', () => {
    expect(hasBackofficePermission(['PLATFORM_ADMIN'], 'ROLE_ASSIGNMENTS_MANAGE')).toBe(true);
    expect(hasBackofficePermission(['PLATFORM_ADMIN'], 'BACKOFFICE_ACCESS')).toBe(true);
    expect(hasBackofficePermission(['SAFETY_OFFICER'], 'ROLE_ASSIGNMENTS_MANAGE')).toBe(false);
    expect(hasBackofficePermission(['AUDITOR'], 'AUDIT_EVENTS_READ')).toBe(true);
    expect(hasBackofficePermission(['OPERATIONS_ANALYST'], 'AUDIT_EVENTS_READ')).toBe(false);
    expect(hasBackofficePermission(['SAFETY_OFFICER', 'AUDITOR'], 'AUDIT_EVENTS_READ')).toBe(true);
  });

  it('keeps safety work separate from platform administration', () => {
    expect(hasBackofficePermission(['PLATFORM_ADMIN'], 'SAFETY_CASES_READ_ALL')).toBe(true);
    expect(hasBackofficePermission(['PLATFORM_ADMIN'], 'SAFETY_CASES_WORK')).toBe(false);
    expect(hasBackofficePermission(['SAFETY_OFFICER'], 'SAFETY_CASES_WORK')).toBe(true);
    expect(hasBackofficePermission(['SAFETY_OFFICER'], 'SAFETY_RESTRICTIONS_WORK')).toBe(true);
    expect(hasBackofficePermission(['SAFETY_OFFICER'], 'ROLE_ASSIGNMENTS_MANAGE')).toBe(false);
    expect(hasBackofficePermission(['AUDITOR'], 'SAFETY_CASES_WORK')).toBe(false);
  });
  it('limits restricted deleted-account records to platform admin and safety officer', () => {
    expect(hasBackofficePermission(['PLATFORM_ADMIN'], 'ACCOUNT_RESTRICTED_RECORD_READ')).toBe(
      true,
    );
    expect(hasBackofficePermission(['SAFETY_OFFICER'], 'ACCOUNT_RESTRICTED_RECORD_READ')).toBe(
      true,
    );
    expect(hasBackofficePermission(['OPERATIONS_ANALYST'], 'ACCOUNT_RESTRICTED_RECORD_READ')).toBe(
      false,
    );
    expect(hasBackofficePermission(['AUDITOR'], 'ACCOUNT_RESTRICTED_RECORD_READ')).toBe(false);
  });
  it('normalizes reason using Unicode code points and enforces 1–500', () => {
    expect(normalizeBackofficeReason('  安全复核  ')).toBe('安全复核');
    expect(normalizeBackofficeReason('😀'.repeat(500))).toHaveLength(1000);
    expect(() => normalizeBackofficeReason('  ')).toThrow('BACKOFFICE_REASON_INVALID');
    expect(() => normalizeBackofficeReason('😀'.repeat(501))).toThrow('BACKOFFICE_REASON_INVALID');
  });
  it('creates stable normalized command content and stable role order', () => {
    const base = { action: 'GRANT' as const, targetUserId: 'u', role: 'AUDITOR' as const };
    expect(roleCommandContent({ ...base, reason: ' why ' })).toBe(
      roleCommandContent({ ...base, reason: 'why' }),
    );
    expect(roleCommandContent({ ...base, reason: 'why' })).not.toBe(
      roleCommandContent({ ...base, action: 'REVOKE', reason: 'why' }),
    );
    expect(sortBackofficeRoles(['AUDITOR', 'PLATFORM_ADMIN', 'AUDITOR'])).toEqual([
      'PLATFORM_ADMIN',
      'AUDITOR',
    ]);
  });
  it('protects only an active final platform administrator', () => {
    expect(wouldRemoveLastPlatformAdmin(1, true)).toBe(true);
    expect(wouldRemoveLastPlatformAdmin(2, true)).toBe(false);
    expect(wouldRemoveLastPlatformAdmin(1, false)).toBe(false);
  });
});
