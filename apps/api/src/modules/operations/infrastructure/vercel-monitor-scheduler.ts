import type { WorkerOwner } from '../../../infrastructure/managed/worker-owner.service.js';
import { QueueClient } from '@vercel/queue';
import type { MonitorScheduler } from '../domain/ports/monitor-scheduler.port.js';
export class VercelMonitorScheduler implements MonitorScheduler {
  constructor(
    private queue?: Pick<QueueClient, 'send'>,
    private owner?: WorkerOwner,
  ) {}
  async schedule(environment: string, intervalSeconds: number, window: number): Promise<void> {
    this.queue ??= new QueueClient();
    const producer = this.owner ?? this.queue;
    await producer.send(
      'slogan-observability',
      { kind: 'monitor', window },
      {
        delaySeconds: Math.max(0, Math.ceil(window * intervalSeconds - Date.now() / 1000)),
        retentionSeconds: 604800,
        idempotencyKey: `monitor-${environment}-${intervalSeconds}-${window}`,
      },
    );
  }
}
