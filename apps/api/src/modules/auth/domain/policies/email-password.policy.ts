import { EmailAuthError } from '../errors/email-auth.error.js';

export const COMMON_PASSWORD_POLICY_VERSION = '2026-09-v1';
const commonPasswords = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  '11111111',
  '00000000',
  'abcdefgh',
  'abcd1234',
  'iloveyou',
  'letmein123',
  'admin123',
  'welcome1',
  'welcome123',
  'changeme',
  'slogan123',
  '87654321',
  '1q2w3e4r',
  '1234abcd',
  'football',
  'sunshine',
]);

export function normalizeUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new EmailAuthError('EMAIL_USERNAME_INVALID');
  return username;
}

export function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  const parts = email.split('@');
  const local = parts[0] ?? '';
  const domain = parts[1] ?? '';
  if (
    email.length > 254 ||
    parts.length !== 2 ||
    local.length < 1 ||
    local.length > 64 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..') ||
    !domain.includes('.') ||
    domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  )
    throw new EmailAuthError('EMAIL_ADDRESS_INVALID');
  return email;
}

export function assertPasswordInput(password: string): void {
  const length = [...password].length;
  if (length < 8 || length > 128 || /[\uD800-\uDFFF]/u.test(password)) {
    throw new EmailAuthError('EMAIL_PASSWORD_INVALID');
  }
}

export function assertNewPassword(password: string): void {
  assertPasswordInput(password);
  if (commonPasswords.has(password.toLowerCase())) throw new EmailAuthError('EMAIL_PASSWORD_WEAK');
}
