import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../../config/environment.js';
import {
  EMAIL_DELIVERY_REPOSITORY,
  type EmailDeliveryRepository,
} from '../../domain/ports/email-delivery.repository.js';
import {
  EMAIL_SECURITY,
  MAIL_SENDER,
  type EmailSecurity,
  type MailSender,
} from '../../domain/ports/email-security.port.js';

@Injectable()
export class AuthMailService {
  constructor(
    @Inject(EMAIL_DELIVERY_REPOSITORY) private readonly repository: EmailDeliveryRepository,
    @Inject(EMAIL_SECURITY) private readonly security: EmailSecurity,
    @Inject(MAIL_SENDER) private readonly sender: MailSender,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  async disablePending(now = new Date()): Promise<void> {
    if (
      this.config.get('EMAIL_AUTH_MAIL_ENABLED', { infer: true }) ??
      this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true })
    )
      throw new Error('EMAIL_MAIL_STILL_ENABLED');
    await this.repository.cancelPending(now);
  }
  async tick(now = new Date()): Promise<number> {
    await this.repository.cleanup(now);
    if (!(
      this.config.get('EMAIL_AUTH_MAIL_ENABLED', { infer: true }) ??
      this.config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true })
    ))
      return 0;
    const claims = await this.repository.claim(now);
    await Promise.all(
      claims.map(async (row) => {
        let result: 'SENT' | 'REJECTED' | 'UNCERTAIN' | 'INVALID_PAYLOAD';
        try {
          const payload = this.security.decrypt(row.id, row.encryptedPayload, row.keyId);
          result = await this.sender.send(row.id, payload);
        } catch {
          result = 'INVALID_PAYLOAD';
        }
        await this.repository.settle(row.id, row.generation, result, new Date());
      }),
    );
    return claims.length;
  }
}
