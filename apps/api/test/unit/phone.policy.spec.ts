import { PhonePolicy } from '../../src/modules/auth/index.js';

describe('phone policy', () => {
  const policy = new PhonePolicy(
    'v1',
    'test-phone-identity-pepper-with-at-least-32-characters',
    new Set(['CN', 'US']),
  );

  it('normalizes equivalent international inputs to one versioned lookup hash', () => {
    const first = policy.normalize('+86 138 0013 8000');
    const second = policy.normalize('13800138000', 'CN');
    expect(first).toMatchObject({
      lookupVersion: 'v1',
      countryCallingCode: '86',
      lastTwo: '00',
      region: 'CN',
    });
    expect(first.lookupHash).toBe(second.lookupHash);
    expect(first.lookupHash).toHaveLength(64);
  });

  it('rejects invalid numbers and unsupported regions without returning the input', () => {
    expect(() => policy.normalize('not-a-number')).toThrow('Phone number is invalid');
    expect(() => policy.normalize('+442079460018')).toThrow('Phone region is unsupported');
  });
});
