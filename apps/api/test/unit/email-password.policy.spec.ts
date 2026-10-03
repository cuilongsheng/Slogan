import {
  normalizeUsername,
  normalizeEmail,
  assertNewPassword,
  assertPasswordInput,
} from '../../src/modules/auth/testing.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/testing.js';

describe('email password policy', () => {
  it('normalizes ASCII identities without collapsing plus or dots', () => {
    expect(normalizeUsername(' Foo_BAR ')).toBe('foo_bar');
    expect(normalizeEmail(' A.B+tag@Example.COM ')).toBe('a.b+tag@example.com');
    for (const value of ['ab', '名字abc', 'ab-c', 'a'.repeat(21)])
      expect(() => normalizeUsername(value)).toThrow();
    for (const value of [
      'a..b@test.com',
      '.a@test.com',
      'a@-test.com',
      'é@test.com',
      'a@例子.com',
      'a@b',
      'a@@test.com',
    ])
      expect(() => normalizeEmail(value)).toThrow();
  });
  it('counts code points, preserves whitespace and rejects weak passwords', () => {
    expect(() => assertNewPassword('😀'.repeat(8))).not.toThrow();
    expect(() => assertNewPassword('😀'.repeat(128))).not.toThrow();
    expect(() => assertNewPassword('😀'.repeat(129))).toThrow();
    expect(() => assertNewPassword('abc1234')).toThrow();
    expect(() => assertNewPassword('password')).toThrow();
    expect(() => assertNewPassword(' password ')).not.toThrow();
    expect(() => assertPasswordInput('password')).not.toThrow();
    expect(() => assertPasswordInput('abcdefgh\ud800')).toThrow();
  });
  it('uses independent salts, original Unicode bytes, versioned parameters and dummy work', async () => {
    const hasher = new ScryptPasswordHasher();
    const password = ' café😀 123 ';
    const [a, b] = await Promise.all([hasher.hash(password), hasher.hash(password)]);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^scrypt\$v1\$32768\$8\$1\$/);
    expect(await hasher.verify(password, a)).toBe(true);
    expect(await hasher.verify(password.trim(), a)).toBe(false);
    expect(await hasher.verify(password.normalize('NFD'), a)).toBe(false);
    expect(await hasher.verify('wrong password', a)).toBe(false);
    expect(await hasher.verify(password, null)).toBe(false);
    expect(await hasher.verify(password, a.replace('32768', '1048576'))).toBe(false);
  });
  it('bounds concurrent hashing and its pending queue', async () => {
    const hasher = new ScryptPasswordHasher();
    const results = await Promise.allSettled(
      Array.from({ length: 23 }, () => hasher.hash('unique-password')),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(22);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});
