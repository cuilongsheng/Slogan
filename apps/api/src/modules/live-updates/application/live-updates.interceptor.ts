import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { concatMap } from 'rxjs';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service.js';
import { LiveUpdatesService } from './live-updates.service.js';
/** Publication failure cannot turn a committed business command into a failed command. */
@Injectable()
export class LiveUpdatesInterceptor implements NestInterceptor {
  constructor(
    private readonly live: LiveUpdatesService,
    private readonly logger: StructuredLogger,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<{ method: string; path?: string }>();
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ||
      request.path === '/v1/me/presence/heartbeat'
    )
      return next.handle();
    return next.handle().pipe(
      concatMap(async (value: unknown) => {
        try {
          await this.live.recover();
        } catch {
          this.logger.warn('live_update_dispatch_pending');
        }
        return value;
      }),
    );
  }
}
