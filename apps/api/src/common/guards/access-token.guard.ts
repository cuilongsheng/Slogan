import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthError, SessionService } from '../../modules/auth/index.js';
import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator.js';

type AuthenticatedRequest = Request & { user?: { userId: string; sessionId: string } };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (authorization === undefined || !authorization.startsWith('Bearer ')) {
      throw new AuthError('ACCESS_TOKEN_INVALID', 'A valid bearer token is required');
    }
    request.user = await this.sessions.verifyAccessToken(authorization.slice('Bearer '.length));
    return true;
  }
}
