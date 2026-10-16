import { fn } from 'jest-mock';
import { VercelMonitorScheduler } from './vercel-monitor-scheduler.js';
describe('managed monitoring publish protocol', () => {
  it('deduplicates reseed and redelivery by environment, interval and window', async () => {
    const send = fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
      messageId: 'fixture',
    });
    const scheduler = new VercelMonitorScheduler({ send } as never);
    await scheduler.schedule('test', 60, 123);
    await scheduler.schedule('test', 60, 123);
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
    expect(send.mock.calls[0]).toEqual([
      'slogan-observability',
      { kind: 'monitor', window: 123 },
      { delaySeconds: 0, retentionSeconds: 604800, idempotencyKey: 'monitor-test-60-123' },
    ]);
  });
});
