import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import { EmailAuthError } from '../domain/errors/email-auth.error.js';
import type { EmailMailPayload, EmailSecurity } from '../domain/ports/email-security.port.js';

@Injectable()
export class EmailSecurityAdapter implements EmailSecurity {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  newToken(): string {
    return randomBytes(32).toString('base64url');
  }
  digest(token: string): string {
    const id = this.config.get('EMAIL_AUTH_HMAC_KEY_ID', { infer: true });
    return this.mac(id, token);
  }
  digests(token: string): string[] {
    return Object.keys(this.keys('HMAC')).map((id) => this.mac(id, token));
  }
  fingerprint(value: string): string {
    return this.digest(`quota:${value}`);
  }
  encrypt(id: string, payload: EmailMailPayload) {
    const keyId = this.config.get('EMAIL_AUTH_AES_KEY_ID', { infer: true });
    const key = this.keys('AES')[keyId];
    if (!key) throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`email-delivery:v1:${id}:${keyId}`));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    return {
      keyId,
      encryptedPayload: Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64'),
    };
  }
  decrypt(id: string, encryptedPayload: string, keyId: string): EmailMailPayload {
    try {
      const key = this.keys('AES')[keyId];
      if (!key) throw new Error();
      const bytes = Buffer.from(encryptedPayload, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(`email-delivery:v1:${id}:${keyId}`));
      decipher.setAuthTag(bytes.subarray(12, 28));
      const payload = JSON.parse(
        Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'),
      ) as EmailMailPayload;
      if (
        typeof payload.to !== 'string' ||
        typeof payload.token !== 'string' ||
        !['REGISTER', 'LINK', 'RESET_PASSWORD'].includes(payload.purpose)
      )
        throw new Error();
      return payload;
    } catch {
      throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    }
  }
  private mac(id: string, value: string): string {
    const key = this.keys('HMAC')[id];
    if (!key) throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    return `${id}:${createHmac('sha256', key).update(value).digest('hex')}`;
  }
  private keys(type: 'HMAC' | 'AES'): Record<string, Buffer> {
    const raw = this.config.get(type === 'HMAC' ? 'EMAIL_AUTH_HMAC_KEYS' : 'EMAIL_AUTH_AES_KEYS', {
      infer: true,
    });
    if (!raw) throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    const keys = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(keys).map(([id, key]) => [id, Buffer.from(key, 'base64')]),
    );
  }
}
