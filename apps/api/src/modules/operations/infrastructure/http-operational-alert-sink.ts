import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import type { OperationalAlertSink } from '../domain/ports/incidents.repository.js';

@Injectable()
export class HttpOperationalAlertSink implements OperationalAlertSink {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async send(payload: Parameters<OperationalAlertSink['send']>[0]): Promise<void> {
    const url = this.config.get('OPERATIONS_ALERT_SINK_URL', { infer: true });
    const token = this.config.get('OPERATIONS_ALERT_SINK_TOKEN', { infer: true });
    if (!url || !token) throw new Error('ALERT_SINK_NOT_CONFIGURED');
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get('OPERATIONS_ALERT_TIMEOUT_MS', { infer: true }),
    );
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('ALERT_SINK_REJECTED');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError')
        throw new Error('ALERT_SINK_TIMEOUT', { cause: error });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
