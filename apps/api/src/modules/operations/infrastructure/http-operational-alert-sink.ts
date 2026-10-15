import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createTransport } from '@sentry/nestjs';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../../config/environment.js';
import type { OperationalAlertSink } from '../domain/ports/incidents.repository.js';
import { readSentryConfiguration } from '../../../config/sentry.js';

@Injectable()
export class HttpOperationalAlertSink implements OperationalAlertSink {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  async send(payload: Parameters<OperationalAlertSink['send']>[0]): Promise<void> {
    const url = this.config.get('OPERATIONS_ALERT_SINK_URL', { infer: true });
    const token = this.config.get('OPERATIONS_ALERT_SINK_TOKEN', { infer: true });
    const sentry = this.config.get('OPERATIONS_ALERT_SINK_KIND', { infer: true }) === 'sentry';
    if (!sentry && (!url || !token)) throw new Error('ALERT_SINK_NOT_CONFIGURED');
    const identifier = (value: string) => /^[A-Z][A-Z0-9_]{0,63}$/.test(value);
    if (
      ![payload.component, payload.category, payload.reasonCode, payload.scopeType].every(
        identifier,
      ) ||
      !['OPEN', 'ACKNOWLEDGED', 'RESOLVED'].includes(payload.status) ||
      !['INFO', 'WARNING', 'HIGH', 'CRITICAL'].includes(payload.severity) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payload.firstObservedAt)
    )
      throw new Error('ALERT_SINK_PAYLOAD_INVALID');
    const notification = {
      status: payload.status,
      component: payload.component,
      category: payload.category,
      severity: payload.severity,
      scopeType: payload.scopeType,
      reasonCode: payload.reasonCode,
      firstObservedAt: payload.firstObservedAt,
    };
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.get('OPERATIONS_ALERT_TIMEOUT_MS', { infer: true }),
    );
    try {
      if (sentry) {
        const configuration = readSentryConfiguration({
          SENTRY_DSN: this.config.get('SENTRY_DSN', { infer: true }),
          NODE_ENV: this.config.get('NODE_ENV', { infer: true }),
        });
        if (!configuration) throw new Error('ALERT_SINK_NOT_CONFIGURED');
        const dsn = new URL(configuration.dsn);
        const endpoint = new URL(`/api${dsn.pathname}/envelope/`, dsn.origin);
        endpoint.searchParams.set('sentry_key', dsn.username);
        endpoint.searchParams.set('sentry_version', '7');
        const transport = createTransport({ recordDroppedEvent() {} }, async (request) => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/x-sentry-envelope' },
            body: request.body as BodyInit,
            signal: controller.signal,
            redirect: 'error',
          });
          await response.body?.cancel();
          return { statusCode: response.status };
        });
        const event = {
          event_id: randomUUID().replaceAll('-', ''),
          platform: 'node',
          environment: configuration.environment,
          level: notification.status === 'RESOLVED' ? ('info' as const) : ('error' as const),
          message:
            notification.status === 'RESOLVED' ? 'OPERATIONAL_RECOVERY' : 'OPERATIONAL_ALERT',
          fingerprint: [
            'slogan-operations',
            notification.component,
            notification.category,
            notification.status,
          ],
          tags: { service: 'monitor', ...notification },
        };
        const result = await transport.send([
          { event_id: event.event_id, sent_at: new Date().toISOString() },
          [[{ type: 'event' }, event]],
        ]);
        if (!result.statusCode || result.statusCode < 200 || result.statusCode >= 300)
          throw new Error('ALERT_SINK_REJECTED');
        return;
      }
      const response = await fetch(url!, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(notification),
        signal: controller.signal,
      });
      await response.body?.cancel();
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
