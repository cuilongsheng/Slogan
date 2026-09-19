import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../config/environment.js';
import { AuthError } from '../domain/errors/auth.error.js';
import type { SmsProvider } from '../domain/ports/sms-provider.port.js';

@Injectable()
export class HttpSmsAdapter implements SmsProvider {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async send(input: {
    to: string;
    code: string;
    template: string;
    sender: string;
    locale?: string;
    correlationId: string;
  }): Promise<void> {
    const url = this.config.get('SMS_PROVIDER_BASE_URL', { infer: true });
    const apiKey = this.config.get('SMS_PROVIDER_API_KEY', { infer: true });
    if (!url || !apiKey)
      throw new AuthError('PHONE_AUTH_DISABLED', 'Phone authentication is unavailable');
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.get('SMS_PROVIDER_TIMEOUT_MS', { infer: true }),
    );
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AuthError(
          response.status >= 500 ? 'SMS_PROVIDER_UNCERTAIN' : 'SMS_PROVIDER_FAILED',
          'SMS provider rejected the request',
        );
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (controller.signal.aborted) {
        throw new AuthError('SMS_PROVIDER_TIMEOUT', 'SMS provider timed out');
      }
      throw new AuthError('SMS_PROVIDER_UNCERTAIN', 'SMS delivery status is uncertain');
    } finally {
      clearTimeout(timer);
    }
  }
}
