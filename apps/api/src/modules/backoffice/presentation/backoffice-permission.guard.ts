import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { CurrentAccessIdentity } from '../../../common/decorators/current-identity.decorator.js';
import { BackofficeService } from '../application/services/backoffice.service.js';
import type { BackofficePermission, BackofficeRole } from '../domain/entities/backoffice.js';
import { BACKOFFICE_PERMISSION } from './backoffice-permission.decorator.js';

export type BackofficeRequest = Request & {
  user: CurrentAccessIdentity;
  backofficeRoles?: BackofficeRole[];
  id?: string;
};

@Injectable()
export class BackofficePermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: BackofficeService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<BackofficePermission>(
      BACKOFFICE_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!permission) return true;
    const request = context.switchToHttp().getRequest<BackofficeRequest>();
    request.backofficeRoles = await this.service.authorize(request.user.userId, permission);
    return true;
  }
}
