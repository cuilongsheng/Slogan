import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Environment } from '../../../config/environment.js';
import { EmailAuthError } from '../domain/errors/email-auth.error.js';
import type { EmailQuota } from '../domain/ports/email-security.port.js';
import { EmailSecurityAdapter } from './email-security.js';

const CONSUME = `
local n = tonumber(ARGV[1])
for i=1,n do
  if tonumber(redis.call('GET',KEYS[i]) or '0') >= tonumber(ARGV[2*i]) then return 0 end
end
if #KEYS > n and redis.call('EXISTS',KEYS[n+1]) == 1 then return 0 end
for i=1,n do
  local value = redis.call('INCR',KEYS[i])
  if value == 1 then redis.call('EXPIRE',KEYS[i],tonumber(ARGV[2*i+1])) end
end
if #KEYS > n then redis.call('SET',KEYS[n+1],'1','EX',60) end
return 1
`;

@Injectable()
export class RedisEmailQuota implements EmailQuota, OnModuleDestroy {
  private readonly client: Redis | undefined;
  private connecting: Promise<void> | undefined;
  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly security: EmailSecurityAdapter,
  ) {
    if (config.get('EMAIL_PASSWORD_AUTH_ENABLED', { infer: true })) {
      this.client = new Redis(config.get('REDIS_URL', { infer: true })!, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 1500,
        commandTimeout: 2000,
        retryStrategy: () => null,
      });
      this.client.on('error', () => undefined);
    }
  }
  async consume(input: {
    source: string;
    target: string;
    mail: boolean;
    cooldown?: string;
  }): Promise<void> {
    if (!this.client) throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    try {
      if (!this.connecting && (this.client.status === 'wait' || this.client.status === 'end'))
        this.connecting = this.client.connect().finally(() => {
          this.connecting = undefined;
        });
      if (this.connecting) await this.connecting;
      if (this.client.status !== 'ready') throw new Error();
      const prefix = 'slogan:{email-auth}:quota:';
      const keys = [
        prefix + 'source:' + this.security.fingerprint(input.source),
        prefix + (input.mail ? 'mail:' : 'login:') + this.security.fingerprint(input.target),
      ];
      const limits = [
        this.config.get('EMAIL_AUTH_SOURCE_LIMIT', { infer: true }),
        900,
        input.mail
          ? this.config.get('EMAIL_AUTH_MAIL_TARGET_LIMIT', { infer: true })
          : this.config.get('EMAIL_AUTH_LOGIN_TARGET_LIMIT', { infer: true }),
        input.mail ? 3600 : 900,
      ];
      if (input.mail) {
        keys.push(prefix + 'global');
        limits.push(this.config.get('EMAIL_AUTH_MAIL_GLOBAL_LIMIT', { infer: true }), 3600);
      }
      const n = keys.length;
      if (input.cooldown)
        keys.push(prefix + 'cooldown:' + this.security.fingerprint(input.cooldown));
      const result = await this.client.eval(CONSUME, keys.length, ...keys, n, ...limits);
      if (result !== 1) throw new EmailAuthError('EMAIL_AUTH_RATE_LIMITED');
    } catch (error) {
      if (error instanceof EmailAuthError) throw error;
      throw new EmailAuthError('EMAIL_AUTH_UNAVAILABLE');
    }
  }
  async onModuleDestroy(): Promise<void> {
    this.client?.disconnect();
  }
}
