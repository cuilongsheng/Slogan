import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service.js';
import { AppError } from '../errors/app-error.js';

type RequestWithId = Request & { id?: string };

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json({
        code: exception.code,
        message: exception.message,
        ...(exception.details === undefined ? {} : { details: exception.details }),
        requestId: request.id,
      });
      return;
    }

    if (this.isPublicCodedError(exception)) {
      const status = this.statusForCode(exception.code);
      response.status(status).json({
        code: exception.code,
        message: exception.message,
        ...('violations' in exception ? { details: exception.violations } : {}),
        requestId: request.id,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const validationDetails =
        typeof body === 'object' && body !== null && 'message' in body
          ? (body as { message?: unknown }).message
          : undefined;
      response.status(status).json({
        code: status === HttpStatus.BAD_REQUEST ? 'VALIDATION_FAILED' : 'HTTP_ERROR',
        message:
          status === HttpStatus.BAD_REQUEST ? 'Request validation failed' : exception.message,
        ...(validationDetails === undefined ? {} : { details: validationDetails }),
        requestId: request.id,
      });
      return;
    }

    const error = exception instanceof Error ? exception : undefined;
    this.logger.error(
      {
        event: 'unhandled_api_error',
        errorName: error?.name ?? 'UnknownError',
        method: request.method,
        path: request.path,
        requestId: request.id,
      },
      error?.stack,
      ApiExceptionFilter.name,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: request.id,
    });
  }

  private isPublicCodedError(
    error: unknown,
  ): error is Error & { code: string; violations?: unknown } {
    if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'string') {
      return false;
    }
    return [
      'ACCESS_TOKEN_INVALID',
      'AUTH_CODE_REJECTED',
      'AUTH_PROVIDER_INVALID',
      'AUTH_PROVIDER_TIMEOUT',
      'AUTH_PROVIDER_UNAVAILABLE',
      'PROFILE_INVALID',
      'REFRESH_TOKEN_INVALID',
      'REFRESH_TOKEN_REUSED',
      'PROFILE_REQUIRED',
      'AGE_RESTRICTED',
      'ROOM_NOT_FOUND',
      'ROOM_ENDED',
      'ROOM_FULL',
      'ROOM_PASSWORD_REQUIRED',
      'ROOM_PASSWORD_INVALID',
      'ROOM_RULES_NOT_ACCEPTED',
      'ROOM_CONFIGURATION_INVALID',
      'VALIDATION_FAILED',
    ].includes(error.code);
  }

  private statusForCode(code: string): number {
    if (code === 'AUTH_PROVIDER_UNAVAILABLE') return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'AUTH_PROVIDER_TIMEOUT') return HttpStatus.GATEWAY_TIMEOUT;
    if (code === 'ACCESS_TOKEN_INVALID' || code.startsWith('REFRESH_TOKEN_')) {
      return HttpStatus.UNAUTHORIZED;
    }
    if (code === 'PROFILE_REQUIRED' || code === 'AGE_RESTRICTED') {
      return HttpStatus.FORBIDDEN;
    }
    if (code === 'ROOM_NOT_FOUND') return HttpStatus.NOT_FOUND;
    if (code === 'ROOM_ENDED' || code === 'ROOM_FULL') return HttpStatus.CONFLICT;
    if (code === 'ROOM_PASSWORD_REQUIRED' || code === 'ROOM_PASSWORD_INVALID') {
      return HttpStatus.FORBIDDEN;
    }
    return HttpStatus.BAD_REQUEST;
  }
}
