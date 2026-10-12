import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { CanActivate, ExecutionContext, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Redis } from 'ioredis';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { Environment } from '../../config/environment.js';
import { AppError } from '../errors/app-error.js';

const CONSUME = `
local value = redis.call('INCR', KEYS[1])
if value == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return {value, ttl}
`;

@Injectable()
export class AuthRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly local: RateLimiterMemory;
  private readonly redis?: Redis;
  private connecting: Promise<void> | undefined;
  private readonly points: number;
  private readonly durationMs: number;
  private readonly sharedRequired: boolean;
  constructor(config: ConfigService<Environment, true>) {
    this.points = config.get('AUTH_RATE_LIMIT_POINTS', { infer: true });
    this.durationMs = config.get('AUTH_RATE_LIMIT_DURATION_SECONDS', { infer: true }) * 1000;
    this.local = new RateLimiterMemory({ points: this.points, duration: this.durationMs / 1000 });
    this.sharedRequired =
      config.get('NODE_ENV', { infer: true }) === 'production' || process.env.VERCEL === '1';
    const url = config.get('REDIS_URL', { infer: true });
    if (url) {
      this.redis = new Redis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 1500,
        commandTimeout: 2000,
        retryStrategy: () => null,
      });
      this.redis.on('error', () => undefined);
    }
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // No OAuth codes, passwords, request bodies, or raw IPs are retained in quota keys.
    // Vercel overwrites this header at its ingress. Other deployments use Express's explicitly trusted proxy configuration.
    const forwarded = request.headers?.['x-forwarded-for'];
    const source =
      process.env.VERCEL === '1' && typeof forwarded === 'string' && isIP(forwarded.trim())
        ? forwarded.trim()
        : (request.ip ?? request.socket.remoteAddress ?? 'unknown');
    const digest = createHash('sha256').update(`${source}:${request.path}`).digest('hex');
    if (!this.redis) {
      if (this.sharedRequired)
        throw new AppError(
          'AUTH_LIMITER_UNAVAILABLE',
          'Authentication is temporarily unavailable',
          503,
        );
      try {
        await this.local.consume(digest);
        return true;
      } catch {
        throw new AppError('RATE_LIMITED', 'Too many authentication requests', 429);
      }
    }
    try {
      if (!this.connecting && ['wait', 'end'].includes(this.redis.status))
        this.connecting = this.redis.connect().finally(() => {
          this.connecting = undefined;
        });
      if (this.connecting) await this.connecting;
      if (this.redis.status !== 'ready') throw new Error();
      const [value, ttl] = (await this.redis.eval(
        CONSUME,
        1,
        `slogan:{auth-limit}:source:${digest}`,
        this.durationMs,
      )) as [number, number];
      if (value > this.points)
        throw new AppError('RATE_LIMITED', 'Too many authentication requests', 429, {
          retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1000)),
        });
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'AUTH_LIMITER_UNAVAILABLE',
        'Authentication is temporarily unavailable',
        503,
      );
    }
  }
  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
