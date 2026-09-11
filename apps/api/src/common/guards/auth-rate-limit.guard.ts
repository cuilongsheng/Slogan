import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';

import type { Environment } from '../../config/environment.js';
import { AppError } from '../errors/app-error.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly limiter: RateLimiterMemory;

  constructor(config: ConfigService<Environment, true>) {
    this.limiter = new RateLimiterMemory({
      points: config.get('AUTH_RATE_LIMIT_POINTS', { infer: true }),
      duration: config.get('AUTH_RATE_LIMIT_DURATION_SECONDS', { infer: true }),
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${request.ip ?? request.socket.remoteAddress ?? 'unknown'}:${request.path}`;
    try {
      await this.limiter.consume(key);
      return true;
    } catch {
      throw new AppError('RATE_LIMITED', 'Too many authentication requests', 429);
    }
  }
}
