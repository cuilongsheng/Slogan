import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EmailAuthError } from '../domain/errors/email-auth.error.js';
import type { PasswordHasher } from '../domain/ports/password-hasher.port.js';

const PREFIX = 'scrypt$v1$32768$8$1';
export const SCRYPT_MAX_CONCURRENT = 2;
export const SCRYPT_MAX_QUEUED = 20;
export const SCRYPT_MAX_MEMORY_BYTES = 64 * 1024 * 1024;

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await this.derive(password, salt);
    return `${PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  async verify(password: string, encoded: string | null): Promise<boolean> {
    // Invalid/missing identities still perform the same bounded scrypt work.
    const match = encoded?.match(/^scrypt\$v1\$32768\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/);
    const salt = Buffer.from(match?.[1] ?? '5dd70ed6fa3c8ae6041fb7a5701123e8', 'hex');
    const expected = Buffer.from(match?.[2] ?? '00'.repeat(64), 'hex');
    const actual = await this.derive(password, salt);
    return timingSafeEqual(actual, expected) && !!match;
  }

  private async derive(password: string, salt: Buffer): Promise<Buffer> {
    if (this.active >= SCRYPT_MAX_CONCURRENT) {
      if (this.queue.length >= SCRYPT_MAX_QUEUED)
        throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else this.active++;
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        scrypt(
          password,
          salt,
          64,
          { N: 32768, r: 8, p: 1, maxmem: SCRYPT_MAX_MEMORY_BYTES },
          (error, key) => {
            if (error) reject(new EmailAuthError('EMAIL_AUTH_UNAVAILABLE'));
            else resolve(key);
          },
        );
      });
    } finally {
      const next = this.queue.shift();
      if (next) next();
      else this.active--;
    }
  }
}
