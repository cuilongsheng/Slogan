import { BACKOFFICE_PERMISSIONS } from '../../src/modules/backoffice/index.js';
import { hasBackofficePermission } from '../../src/modules/backoffice/index.js';
import { assertNewPassword } from '../../src/modules/auth/index.js';
describe('public trial permission boundary', () => {
  it('has exactly the safe read surface and no private permissions', () => {
    const allowed = BACKOFFICE_PERMISSIONS.filter((permission) =>
      hasBackofficePermission(['PUBLIC_TRIAL_VIEWER'], permission),
    );
    expect(allowed).toEqual(['BACKOFFICE_ACCESS', 'PUBLIC_ROOM_SUMMARIES_READ']);
  });
  it('preserves ordinary weak-password rejection', () => {
    expect(() => assertNewPassword('12345678')).toThrow();
  });
});
