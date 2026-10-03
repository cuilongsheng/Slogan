import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { RedisEmailQuota } from '../../src/modules/auth/testing.js';
import { EmailSecurityAdapter } from '../../src/modules/auth/testing.js';
import { emailConfig } from '../fixtures/email-auth.js';

describe('distributed email quota', () => {
  const config = emailConfig({ REDIS_URL: 'redis://127.0.0.1:56379/8' });
  const security = new EmailSecurityAdapter(config);
  const first = new RedisEmailQuota(config, security);
  const second = new RedisEmailQuota(config, security);
  const redis = new Redis('redis://127.0.0.1:56379/8');
  beforeEach(async () => {
    await redis.flushdb();
  });
  afterAll(async () => {
    await first.onModuleDestroy();
    await second.onModuleDestroy();
    await redis.flushdb();
    redis.disconnect();
  });
  it('atomically counts unknown login targets across two instances without plaintext keys', async () => {
    await first.consume({ source: randomUUID(), target: randomUUID(), mail: false });
    await second.consume({ source: randomUUID(), target: randomUUID(), mail: false });
    const target = `unknown-${randomUUID()}@example.test`;
    const results = await Promise.allSettled(
      Array.from({ length: 16 }, (_, i) =>
        (i % 2 ? first : second).consume({ source: randomUUID(), target, mail: false }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(10);
    for (const r of results)
      if (r.status === 'rejected')
        expect(r.reason).toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
    const keys = await redis.keys('slogan:{email-auth}:quota:*');
    expect(keys.some((k) => k.includes(target))).toBe(false);
  });
  it('shares mail target limits and resend cooldown', async () => {
    const target = randomUUID();
    const cooldown = randomUUID();
    await first.consume({ source: randomUUID(), target, mail: true, cooldown });
    await expect(
      second.consume({ source: randomUUID(), target, mail: true, cooldown }),
    ).rejects.toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
    for (let i = 0; i < 4; i++) await first.consume({ source: randomUUID(), target, mail: true });
    await expect(
      second.consume({ source: randomUUID(), target, mail: true }),
    ).rejects.toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
  });
  it('fails closed when Redis is unreachable', async () => {
    const unavailable = new RedisEmailQuota(
      emailConfig({ REDIS_URL: 'redis://127.0.0.1:1' }),
      security,
    );
    await expect(
      unavailable.consume({ source: 'fixture', target: 'unknown', mail: false }),
    ).rejects.toMatchObject({ code: 'EMAIL_AUTH_UNAVAILABLE' });
    await unavailable.onModuleDestroy();
  });
  it('shares source and global mail counters and never exceeds the global allowance', async () => {
    const source = randomUUID();
    for (let i = 0; i < 20; i++) await first.consume({ source, target: randomUUID(), mail: false });
    await expect(
      second.consume({ source, target: randomUUID(), mail: false }),
    ).rejects.toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
    const outcomes = await Promise.allSettled(
      Array.from({ length: 110 }, (_, i) =>
        (i % 2 ? first : second).consume({
          source: randomUUID(),
          target: randomUUID(),
          mail: true,
        }),
      ),
    );
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(100);
    for (const r of outcomes)
      if (r.status === 'rejected')
        expect(r.reason).toMatchObject({ code: 'EMAIL_AUTH_RATE_LIMITED' });
  });
});
