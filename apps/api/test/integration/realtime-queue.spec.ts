import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { Environment } from '../../src/config/environment.js';
import { RealtimeQueue } from '../../src/infrastructure/redis/realtime-queue.service.js';
import { StructuredLogger } from '../../src/infrastructure/observability/structured-logger.service.js';
import { realtimeEnvironment } from '../fixtures/realtime.js';

async function until(check: () => Promise<boolean>, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('queue condition timed out');
}
describe('realtime Redis queue', () => {
  let connection: Redis;
  let inspect: Queue;
  let queue: RealtimeQueue;
  beforeEach(async () => {
    connection = new Redis(realtimeEnvironment().REDIS_URL!, { maxRetriesPerRequest: null });
    inspect = new Queue('slogan-realtime', { connection });
    await inspect.obliterate({ force: true });
    queue = new RealtimeQueue(
      new ConfigService<Environment, true>(realtimeEnvironment()),
      new StructuredLogger(),
    );
  });
  afterEach(async () => {
    await queue.onModuleDestroy();
    await inspect.obliterate({ force: true });
    await inspect.close();
    connection.disconnect();
  });
  async function enqueue(id: string, at: Date) {
    await until(async () => {
      try {
        await queue.enqueue({ kind: 'expiry', id }, at);
        return true;
      } catch {
        return false;
      }
    });
  }
  it('deduplicates pending deadlines and executes after the delay', async () => {
    const seen: string[] = [];
    await queue.start(async (job) => {
      seen.push(job.id);
    });
    const at = new Date(Date.now() + 400);
    await enqueue('room-test', at);
    await enqueue('room-test', at);
    expect(seen).toHaveLength(0);
    expect(await inspect.getDelayedCount()).toBe(1);
    await until(async () => seen.length === 1);
    expect(seen).toEqual(['room-test']);
  });
  it('retries transient failures with bounded attempts', async () => {
    let attempts = 0;
    await queue.start(async () => {
      attempts++;
      if (attempts < 2) throw new Error('transient');
    });
    await enqueue('retry-test', new Date());
    await until(async () => attempts === 2);
    expect(attempts).toBe(2);
  });
  it('recreates a missing job from the same persisted deadline after a worker restart', async () => {
    await queue.start(async () => {});
    const at = new Date(Date.now() + 1000);
    await enqueue('restored-room', at);
    await queue.onModuleDestroy();
    await inspect.obliterate({ force: true });
    queue = new RealtimeQueue(
      new ConfigService<Environment, true>(realtimeEnvironment()),
      new StructuredLogger(),
    );
    const seen: string[] = [];
    await queue.start(async (job) => {
      seen.push(job.id);
    });
    await enqueue('restored-room', at);
    await until(async () => seen.length === 1);
    expect(seen).toEqual(['restored-room']);
  });
  it('requeues a terminal Redis failure when PostgreSQL still requires the same job', async () => {
    const at = new Date();
    const jobId = `expiry-exhausted-room-${at.getTime()}`;
    let failing = true;
    let calls = 0;
    await inspect.add('expiry', { kind: 'expiry', id: 'exhausted-room' }, { jobId, attempts: 1 });
    await queue.start(async () => {
      calls++;
      if (failing) throw new Error('temporary database outage');
    });
    await until(
      async () =>
        (await inspect.getJob(jobId))?.getState().then((state) => state === 'failed') ?? false,
    );
    failing = false;
    await enqueue('exhausted-room', at);
    await until(async () => calls === 2);
    expect(calls).toBe(2);
  });
});
