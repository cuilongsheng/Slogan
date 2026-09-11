import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface CurrentAccessIdentity {
  userId: string;
  sessionId: string;
}

type AuthenticatedRequest = Request & { user: CurrentAccessIdentity };

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAccessIdentity =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
