import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import type { Request } from 'express';
@Injectable()
export class HealthRateLimitGuard implements CanActivate {
  private readonly limiter = new RateLimiterMemory({ points: 120, duration: 60 });
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    try {
      await this.limiter.consume(request.ip ?? 'unknown');
      return true;
    } catch {
      throw new HttpException('Health probe rate limited', 429);
    }
  }
}
