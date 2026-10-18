import { AppError } from '../errors/app-error.js';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AuthError, SessionService, type VerifiedAccessContext } from '../../modules/auth/index.js';
import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator.js';

type AuthenticatedRequest = Request & {
  user?: { userId: string; sessionId: string };
  verifiedAccess?: VerifiedAccessContext;
};

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
    request.verifiedAccess = await this.sessions.verifyAccessContext(
      authorization.slice('Bearer '.length),
    );
    request.user = {
      userId: request.verifiedAccess.userId,
      sessionId: request.verifiedAccess.sessionId,
    };
    if (request.verifiedAccess.trial) {
      const path = request.path.replace(/\/$/, '');
      const permitted =
        (request.method === 'GET' &&
          ['/v1/me', '/v1/backoffice/me', '/v1/backoffice/public-rooms'].includes(path)) ||
        (request.method === 'POST' && ['/v1/auth/logout', '/v1/auth/web/logout'].includes(path));
      if (!permitted)
        throw new AppError('BACKOFFICE_ACCESS_DENIED', 'Public trial access is read-only', 403);
    }

    return true;
  }
}
