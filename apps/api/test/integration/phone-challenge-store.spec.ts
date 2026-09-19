import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Environment } from '../../src/config/environment.js';
import { RedisPhoneChallengeStore } from '../../src/modules/auth/testing.js';
import { testEnvironment } from '../fixtures/environment.js';

describe('Redis phone challenge store', () => {
  const redisUrl = 'redis://127.0.0.1:56379/12';
  let inspect: Redis;
  let store: RedisPhoneChallengeStore;
  const phone = {
    lookupVersion: 'v1',
    lookupHash: 'a'.repeat(64),
    countryCallingCode: '86',
    lastTwo: '00',
    region: 'CN',
  };

  beforeEach(async () => {
    inspect = new Redis(redisUrl);
    await inspect.flushdb();
    store = new RedisPhoneChallengeStore(
      new ConfigService<Environment, true>(
        testEnvironment({
          REDIS_URL: redisUrl,
          PHONE_OTP_MAX_ATTEMPTS: 2,
          PHONE_OTP_RESEND_COOLDOWN_SECONDS: 10,
          PHONE_OTP_RATE_LIMIT_POINTS: 3,
          PHONE_OTP_RATE_LIMIT_DURATION_SECONDS: 60,
          PHONE_OTP_GLOBAL_RATE_LIMIT_POINTS: 20,
          PHONE_VERIFICATION_GRANT_TTL_SECONDS: 60,
        }),
      ),
    );
  });

  afterEach(async () => {
    store.onModuleDestroy();
    await inspect.flushdb();
    inspect.disconnect();
  });

  async function issue(hash = phone.lookupHash) {
    return store.issue({
      purpose: 'LOGIN',
      phone: { ...phone, lookupHash: hash },
      source: `source-${hash}`,
      deviceId: `device-${hash}`,
      codeDigest: 'correct',
      now: new Date(),
    });
  }

  it('isolates purpose, exhausts attempts and never stores a plaintext code', async () => {
    const challenge = await issue();
    const keys = await inspect.keys('auth:phone:challenge:*');
    expect(keys).toHaveLength(1);
    expect(JSON.stringify(await inspect.hgetall(keys[0]!))).not.toContain('123456');
    await expect(
      store.verify({
        challengeId: challenge.challengeId,
        purpose: 'LINK',
        clientRequestId: crypto.randomUUID(),
        codeDigest: 'correct',
        now: new Date(),
      }),
    ).rejects.toMatchObject({ code: 'PHONE_CHALLENGE_INVALID' });
    for (const expected of ['PHONE_CHALLENGE_INVALID', 'PHONE_CHALLENGE_ATTEMPTS_EXHAUSTED']) {
      await expect(
        store.verify({
          challengeId: challenge.challengeId,
          purpose: 'LOGIN',
          clientRequestId: crypto.randomUUID(),
          codeDigest: 'wrong',
          now: new Date(),
        }),
      ).rejects.toMatchObject({ code: expected });
    }
  });

  it('allows at most one concurrent correct consumption and binds the grant to the request', async () => {
    const challenge = await issue('b'.repeat(64));
    const clientRequestId = crypto.randomUUID();
    const input = {
      challengeId: challenge.challengeId,
      purpose: 'LOGIN' as const,
      clientRequestId,
      codeDigest: 'correct',
      now: new Date(),
    };
    const results = await Promise.allSettled([store.verify(input), store.verify(input)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const grant = (
      results.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<
        Awaited<ReturnType<typeof store.verify>>
      >
    ).value;
    await expect(
      store.readGrant({
        grantId: grant.grantId,
        purpose: 'LOGIN',
        clientRequestId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: 'AUTH_VERIFICATION_GRANT_INVALID' });
    await store.completeGrant(grant.grantId, clientRequestId);
    await expect(
      store.readGrant({ grantId: grant.grantId, purpose: 'LOGIN', clientRequestId }),
    ).rejects.toMatchObject({
      code: 'AUTH_VERIFICATION_GRANT_INVALID',
    });
  });

  it('enforces cooldown before a second provider call can be made', async () => {
    await issue('c'.repeat(64));
    await expect(issue('c'.repeat(64))).rejects.toMatchObject({ code: 'PHONE_RATE_LIMITED' });
  });

  it('removes only orphan temporary keys without touching persistent identity storage', async () => {
    await inspect.set('auth:phone:orphan', 'temporary-without-ttl');
    await inspect.set('unrelated:persistent', 'keep');
    await expect(store.cleanup()).resolves.toBe(1);
    expect(await inspect.exists('auth:phone:orphan')).toBe(0);
    expect(await inspect.get('unrelated:persistent')).toBe('keep');
  });
});
