const jest = import.meta.jest;
import { ConfigService } from '@nestjs/config';
import {
  RedisLiveUpdatesStore,
  validRelease,
} from '../../src/modules/live-updates/infrastructure/redis-live-updates.store.js';
import { testEnvironment } from '../fixtures/environment.js';
const release = {
  version: '0.0.100',
  versionCode: 1100,
  commit: 'a'.repeat(40),
  sha256: 'b'.repeat(64),
  bytes: 85_000_000,
  package: 'com.slogan.mobile',
  apiOrigin: 'https://slogan-api-pi.vercel.app',
  signing: 'controlled-debug',
  certificateSha256: 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c',
};
afterEach(() => jest.restoreAllMocks());
function fixture() {
  const writes: string[] = [];
  const redis = {
    status: 'ready',
    set: jest.fn(async (key: string) => {
      writes.push(key);
      return 'OK';
    }),
    get: jest.fn(async () => '1099'),
  };
  const create = jest.fn(async () => {
    writes.push('outbox');
    return {};
  });
  const store = new RedisLiveUpdatesStore(
    new ConfigService(testEnvironment({ REDIS_URL: 'redis://127.0.0.1:56379/8' })),
    { liveUpdateOutbox: { create } } as never,
  );
  Object.assign(store, { client: redis });
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(release)));
  return { store, redis, create, fetcher, writes };
}
test('reconciles only a verified newer public identity after claiming the shared five-minute lease', async () => {
  const f = fixture();
  await f.store.reconcileRelease();
  expect(f.redis.set.mock.calls[0]).toEqual(['slogan:live:release-check', '1', 'EX', 300, 'NX']);
  expect(f.create).toHaveBeenCalledWith({ data: { scope: 'release' } });
  expect(f.writes).toEqual(['slogan:live:release-check', 'outbox', 'slogan:live:release-version']);
  f.redis.get.mockResolvedValue('1100');
  await f.store.reconcileRelease();
  expect(f.create).toHaveBeenCalledTimes(1);
  f.redis.set.mockResolvedValueOnce(null as never);
  await f.store.reconcileRelease();
  expect(f.fetcher).toHaveBeenCalledTimes(2);
});
test('provider and durable-write failures never record a version and the next lease can recover', async () => {
  const f = fixture();
  f.fetcher.mockRejectedValueOnce(new Error('provider unavailable'));
  await expect(f.store.reconcileRelease()).rejects.toThrow('provider unavailable');
  expect(f.create).not.toHaveBeenCalled();
  f.create.mockRejectedValueOnce(new Error('database unavailable'));
  await expect(f.store.reconcileRelease()).rejects.toThrow('database unavailable');
  expect(f.writes).not.toContain('slogan:live:release-version');
  await f.store.reconcileRelease();
  expect(f.writes.at(-1)).toBe('slogan:live:release-version');
});
test('rejects untrusted or malformed identities before publication', () => {
  expect(validRelease(release)).toBe(true);
  for (const bad of [
    { package: 'other' },
    { apiOrigin: 'https://other.invalid' },
    { certificateSha256: 'c'.repeat(64) },
    { versionCode: 1.5 },
    { sha256: 'no' },
    { commit: 'no' },
    { bytes: 0 },
  ])
    expect(validRelease({ ...release, ...bad })).toBe(false);
});
