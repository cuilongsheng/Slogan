import { createHash, randomUUID } from 'node:crypto';

import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Environment } from '../../../config/environment.js';
import type {
  PhoneChallengePurpose,
  PhoneFingerprint,
  VerificationGrant,
} from '../domain/entities/phone-auth.js';
import { AuthError } from '../domain/errors/auth.error.js';
import type { PhoneChallengeStore } from '../domain/ports/phone-challenge.store.js';

const ISSUE_SCRIPT = `
local limits = {tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4])}
for i = 1, 4 do
  local value = redis.call('INCR', KEYS[i])
  if value == 1 then redis.call('EXPIRE', KEYS[i], tonumber(ARGV[5])) end
  if value > limits[i] then return -1 end
end
if redis.call('SET', KEYS[5], '1', 'NX', 'EX', tonumber(ARGV[6])) == false then return -1 end
redis.call('HSET', KEYS[6],
  'purpose', ARGV[7], 'userId', ARGV[8], 'codeDigest', ARGV[9],
  'lookupVersion', ARGV[10], 'lookupHash', ARGV[11],
  'countryCallingCode', ARGV[12], 'lastTwo', ARGV[13], 'region', ARGV[14],
  'attempts', '0')
redis.call('EXPIRE', KEYS[6], tonumber(ARGV[15]))
return 1
`;

const VERIFY_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
local purpose = redis.call('HGET', KEYS[1], 'purpose')
local userId = redis.call('HGET', KEYS[1], 'userId')
if purpose ~= ARGV[1] or userId ~= ARGV[2] then return -1 end
local expected = redis.call('HGET', KEYS[1], 'codeDigest')
if expected ~= ARGV[3] then
  local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  if attempts >= tonumber(ARGV[4]) then redis.call('DEL', KEYS[1]); return -2 end
  return -1
end
local values = redis.call('HMGET', KEYS[1], 'lookupVersion', 'lookupHash', 'countryCallingCode', 'lastTwo', 'region')
redis.call('DEL', KEYS[1])
redis.call('HSET', KEYS[2],
  'purpose', purpose, 'userId', userId, 'clientRequestId', ARGV[5],
  'lookupVersion', values[1], 'lookupHash', values[2],
  'countryCallingCode', values[3], 'lastTwo', values[4], 'region', values[5])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[6]))
return 1
`;

@Injectable()
export class RedisPhoneChallengeStore implements PhoneChallengeStore, OnModuleDestroy {
  private readonly client: Redis | undefined;
  private readonly otpTtl: number;
  private readonly maxAttempts: number;
  private readonly cooldown: number;
  private readonly ratePoints: number;
  private readonly globalPoints: number;
  private readonly rateDuration: number;
  private readonly grantTtl: number;

  constructor(config: ConfigService<Environment, true>) {
    this.otpTtl = config.get('PHONE_OTP_TTL_SECONDS', { infer: true });
    this.maxAttempts = config.get('PHONE_OTP_MAX_ATTEMPTS', { infer: true });
    this.cooldown = config.get('PHONE_OTP_RESEND_COOLDOWN_SECONDS', { infer: true });
    this.ratePoints = config.get('PHONE_OTP_RATE_LIMIT_POINTS', { infer: true });
    this.globalPoints = config.get('PHONE_OTP_GLOBAL_RATE_LIMIT_POINTS', { infer: true });
    this.rateDuration = config.get('PHONE_OTP_RATE_LIMIT_DURATION_SECONDS', { infer: true });
    this.grantTtl = config.get('PHONE_VERIFICATION_GRANT_TTL_SECONDS', { infer: true });
    const url = config.get('REDIS_URL', { infer: true });
    if (url) {
      this.client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        enableOfflineQueue: false,
      });
      this.client.on('error', () => undefined);
    }
  }

  async issue(input: {
    purpose: PhoneChallengePurpose;
    phone: PhoneFingerprint;
    userId?: string;
    source: string;
    deviceId: string;
    codeDigest: string;
    now: Date;
  }) {
    const client = await this.ready();
    const challengeId = randomUUID();
    const source = this.keyDigest(input.source);
    const device = this.keyDigest(input.deviceId);
    const result = Number(
      await client.eval(
        ISSUE_SCRIPT,
        6,
        `auth:phone:rate:phone:${input.phone.lookupHash}`,
        `auth:phone:rate:source:${source}`,
        `auth:phone:rate:device:${device}`,
        'auth:phone:rate:global',
        `auth:phone:cooldown:${input.purpose}:${input.phone.lookupHash}`,
        this.challengeKey(challengeId),
        this.ratePoints,
        this.ratePoints,
        this.ratePoints,
        this.globalPoints,
        this.rateDuration,
        this.cooldown,
        input.purpose,
        input.userId ?? '',
        input.codeDigest,
        input.phone.lookupVersion,
        input.phone.lookupHash,
        input.phone.countryCallingCode,
        input.phone.lastTwo,
        input.phone.region,
        this.otpTtl,
      ),
    );
    if (result !== 1) throw new AuthError('PHONE_RATE_LIMITED', 'Phone request rate limited');
    return {
      challengeId,
      expiresAt: new Date(input.now.getTime() + this.otpTtl * 1000),
      resendAt: new Date(input.now.getTime() + this.cooldown * 1000),
    };
  }

  async abandon(challengeId: string): Promise<void> {
    const client = await this.ready();
    await client.del(this.challengeKey(challengeId));
  }

  async verify(input: {
    challengeId: string;
    purpose: PhoneChallengePurpose;
    userId?: string;
    clientRequestId: string;
    codeDigest: string;
    now: Date;
  }): Promise<VerificationGrant> {
    const client = await this.ready();
    const grantId = randomUUID();
    const result = Number(
      await client.eval(
        VERIFY_SCRIPT,
        2,
        this.challengeKey(input.challengeId),
        this.grantKey(grantId),
        input.purpose,
        input.userId ?? '',
        input.codeDigest,
        this.maxAttempts,
        input.clientRequestId,
        this.grantTtl,
      ),
    );
    if (result === -2) {
      throw new AuthError('PHONE_CHALLENGE_ATTEMPTS_EXHAUSTED', 'Phone challenge is invalid');
    }
    if (result !== 1) throw new AuthError('PHONE_CHALLENGE_INVALID', 'Phone challenge is invalid');
    return this.readGrant({
      grantId,
      purpose: input.purpose,
      ...(input.userId ? { userId: input.userId } : {}),
      clientRequestId: input.clientRequestId,
    });
  }

  async createProof(input: {
    purpose: 'ACCOUNT_DELETE';
    userId: string;
    clientRequestId: string;
    phone?: PhoneFingerprint;
    now: Date;
  }): Promise<VerificationGrant> {
    const client = await this.ready();
    const grantId = randomUUID();
    await client.hset(this.grantKey(grantId), {
      purpose: input.purpose,
      userId: input.userId,
      clientRequestId: input.clientRequestId,
      lookupVersion: input.phone?.lookupVersion ?? '',
      lookupHash: input.phone?.lookupHash ?? '',
      countryCallingCode: input.phone?.countryCallingCode ?? '',
      lastTwo: input.phone?.lastTwo ?? '',
      region: input.phone?.region ?? '',
    });
    await client.expire(this.grantKey(grantId), this.grantTtl);
    return this.readGrant({ ...input, grantId });
  }

  async readGrant(input: {
    grantId: string;
    purpose: PhoneChallengePurpose;
    userId?: string;
    clientRequestId: string;
  }): Promise<VerificationGrant> {
    const client = await this.ready();
    const record = await client.hgetall(this.grantKey(input.grantId));
    if (
      record.purpose !== input.purpose ||
      record.userId !== (input.userId ?? '') ||
      record.clientRequestId !== input.clientRequestId
    ) {
      throw new AuthError('AUTH_VERIFICATION_GRANT_INVALID', 'Verification grant is invalid');
    }
    return {
      grantId: input.grantId,
      purpose: input.purpose,
      ...(input.userId ? { userId: input.userId } : {}),
      clientRequestId: input.clientRequestId,
      phone: {
        lookupVersion: record.lookupVersion ?? '',
        lookupHash: record.lookupHash ?? '',
        countryCallingCode: record.countryCallingCode ?? '',
        lastTwo: record.lastTwo ?? '',
        region: record.region ?? '',
      },
    };
  }

  async completeGrant(grantId: string, clientRequestId: string): Promise<void> {
    const client = await this.ready();
    await client.eval(
      `if redis.call('HGET', KEYS[1], 'clientRequestId') == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`,
      1,
      this.grantKey(grantId),
      clientRequestId,
    );
  }

  async cleanup(): Promise<number> {
    const client = await this.ready();
    let cursor = '0';
    let removed = 0;
    do {
      const [next, keys] = await client.scan(cursor, 'MATCH', 'auth:phone:*', 'COUNT', 100);
      cursor = next;
      for (const key of keys) {
        if ((await client.pttl(key)) === -1) removed += await client.del(key);
      }
    } while (cursor !== '0');
    return removed;
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
  }

  private async ready(): Promise<Redis> {
    if (!this.client)
      throw new AuthError('PHONE_AUTH_DISABLED', 'Phone authentication is unavailable');
    try {
      if (['wait', 'end'].includes(this.client.status)) await this.client.connect();
      return this.client;
    } catch {
      this.client.disconnect();
      throw new AuthError('AUTH_PROVIDER_UNAVAILABLE', 'Authentication is temporarily unavailable');
    }
  }

  private challengeKey(id: string): string {
    return `auth:phone:challenge:${id}`;
  }

  private grantKey(id: string): string {
    return `auth:phone:grant:${id}`;
  }

  private keyDigest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
