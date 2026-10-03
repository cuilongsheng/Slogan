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

    if (request.path.startsWith('/v1/backoffice')) {
      this.logger.warn(
        {
          event: 'backoffice_request_rejected',
          requestId: request.id,
          resultCode: this.backofficeResultCode(exception),
        },
        ApiExceptionFilter.name,
      );
    }

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
      const retryAfterSeconds = this.retryAfterSeconds(exception);
      if (retryAfterSeconds !== undefined)
        response.setHeader('Retry-After', String(retryAfterSeconds));
      response.status(status).json({
        code: exception.code,
        message: exception.message,
        ...('details' in exception ? { details: exception.details } : {}),
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

    if (!request.path.startsWith('/v1/backoffice')) {
      const error = exception instanceof Error ? exception : undefined;
      this.logger.error(
        {
          event: 'unhandled_api_error',
          errorName: error?.name ?? 'UnknownError',
          method: request.method,
          path: this.safePath(request.path),
          requestId: request.id,
        },
        undefined,
        ApiExceptionFilter.name,
      );
    }
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
      'EMAIL_AUTH_UNAVAILABLE',
      'EMAIL_AUTH_RATE_LIMITED',
      'EMAIL_USERNAME_INVALID',
      'EMAIL_ADDRESS_INVALID',
      'EMAIL_PASSWORD_INVALID',
      'EMAIL_PASSWORD_WEAK',
      'EMAIL_USERNAME_TAKEN',
      'EMAIL_ADDRESS_TAKEN',
      'EMAIL_CREDENTIALS_INVALID',
      'EMAIL_VERIFICATION_REQUIRED',
      'EMAIL_TOKEN_INVALID',
      'EMAIL_COMMAND_CONFLICT',
      'ACCESS_TOKEN_INVALID',
      'AUTH_CODE_REJECTED',
      'AUTH_PROVIDER_INVALID',
      'AUTH_PROVIDER_TIMEOUT',
      'AUTH_PROVIDER_UNAVAILABLE',
      'PROFILE_INVALID',
      'REFRESH_TOKEN_INVALID',
      'REFRESH_TOKEN_REUSED',
      'PHONE_AUTH_DISABLED',
      'PHONE_INVALID',
      'PHONE_REGION_UNSUPPORTED',
      'PHONE_CHALLENGE_INVALID',
      'PHONE_CHALLENGE_EXPIRED',
      'PHONE_CHALLENGE_ATTEMPTS_EXHAUSTED',
      'PHONE_RATE_LIMITED',
      'SMS_PROVIDER_FAILED',
      'SMS_PROVIDER_TIMEOUT',
      'SMS_PROVIDER_UNCERTAIN',
      'AUTH_ACCOUNT_UNAVAILABLE',
      'AUTH_IDENTITY_ALREADY_BOUND',
      'AUTH_LOGIN_METHOD_ALREADY_BOUND',
      'AUTH_VERIFICATION_GRANT_INVALID',
      'AUTH_STEP_UP_INVALID',
      'ACCOUNT_DELETE_CONFIRMATION_REQUIRED',
      'ACCOUNT_DELETE_REQUEST_CONFLICT',
      'ACCOUNT_DELETE_ROLE_ACTIVE',
      'ACCOUNT_DELETE_UNAVAILABLE',
      'RESTRICTED_ACCOUNT_RECORD_DENIED',
      'RESTRICTED_ACCOUNT_RECORD_NOT_FOUND',
      'PROFILE_REQUIRED',
      'AGE_RESTRICTED',
      'ROOM_MEMBERSHIP_REQUIRED',
      'REALTIME_PROVIDER_UNAVAILABLE',
      'REALTIME_WEBHOOK_INVALID',
      'ROOM_ACCOUNT_RESTRICTED',
      'ROOM_HOST_REQUIRED',
      'ROOM_MEMBER_NOT_ACTIVE',
      'ROOM_INVITATION_REQUIRED',
      'ROOM_INVITATION_NOT_FOUND',
      'ROOM_INVITATION_TARGET_UNAVAILABLE',
      'ROOM_INVITATION_REQUEST_CONFLICT',
      'SOCIAL_TARGET_UNAVAILABLE',
      'SOCIAL_REQUEST_NOT_FOUND',
      'SOCIAL_REQUEST_STATE_CONFLICT',
      'SOCIAL_RELATIONSHIP_NOT_FOUND',
      'SOCIAL_REQUEST_CONFLICT',
      'SOCIAL_PRESENCE_UNAVAILABLE',
      'SOCIAL_ACCESS_RESTRICTED',
      'SOCIAL_CURSOR_INVALID',
      'ROOM_SUCCESSOR_INVALID',
      'ROOM_HOST_RECONNECTING',
      'ROOM_OPERATION_CONFLICT',
      'REPORT_TARGET_INVALID',
      'REPORT_CONTEXT_NOT_FOUND',
      'REPORT_REQUEST_CONFLICT',
      'HISTORY_CONTEXT_NOT_FOUND',
      'ROOM_NOT_ENDED',
      'NOTE_VERSION_CONFLICT',
      'ROOM_NOT_FOUND',
      'ROOM_SHARE_NOT_FOUND',
      'ROOM_SHARE_UNAVAILABLE',
      'ROOM_EXTENSION_NOT_AVAILABLE',
      'ROOM_EXTENSION_LIMIT',
      'ROOM_EXTENSION_REQUEST_CONFLICT',
      'ROOM_NOT_STARTED',
      'ROOM_CANCELLED',
      'APPOINTMENT_ALREADY_STARTED',
      'APPOINTMENT_BOOKING_CLOSED',
      'RESERVATION_CONFLICT',
      'RESERVATION_ALREADY_USED',
      'RESERVATION_OWNER_REQUIRED',
      'ROOM_RESERVED',
      'ROOM_ENDED',
      'ROOM_FULL',
      'ROOM_PASSWORD_REQUIRED',
      'ROOM_PASSWORD_INVALID',
      'ROOM_RULES_NOT_ACCEPTED',
      'ROOM_SPEECH_CONSENT_REQUIRED',
      'ROOM_SPEECH_UNAVAILABLE',
      'POST_ROOM_KEYWORDS_CONSENT_REQUIRED',
      'POST_ROOM_KEYWORDS_UNAVAILABLE',
      'ROOM_CONFIGURATION_INVALID',
      'ASSISTANCE_UNAVAILABLE',
      'ASSISTANCE_CONTEXT_UNAVAILABLE',
      'ASSISTANCE_CONSENT_REQUIRED',
      'ASSISTANCE_AUDIO_INVALID',
      'ASSISTANCE_REQUEST_CONFLICT',
      'ASSISTANCE_IN_PROGRESS',
      'ASSISTANCE_RESULT_EXPIRED',
      'ASSISTANCE_RATE_LIMITED',
      'ASSISTANCE_QUOTA_EXCEEDED',
      'ASSISTANCE_PROVIDER_TIMEOUT',
      'ASSISTANCE_PROVIDER_UNAVAILABLE',
      'ASSISTANCE_PROVIDER_RESPONSE_INVALID',
      'ASSISTANCE_REQUEST_FAILED',
      'VALIDATION_FAILED',
    ].includes(error.code);
  }

  private backofficeResultCode(exception: unknown): string {
    if (exception instanceof AppError) return exception.code;
    if (this.isPublicCodedError(exception)) return exception.code;
    if (exception instanceof HttpException && exception.getStatus() === HttpStatus.BAD_REQUEST)
      return 'VALIDATION_FAILED';
    return 'INTERNAL_ERROR';
  }

  private statusForCode(code: string): number {
    if (code === 'EMAIL_AUTH_UNAVAILABLE') return 503;
    if (code === 'EMAIL_AUTH_RATE_LIMITED') return 429;
    if (code === 'EMAIL_CREDENTIALS_INVALID') return 401;
    if (code === 'EMAIL_VERIFICATION_REQUIRED') return 403;
    if (['EMAIL_USERNAME_TAKEN', 'EMAIL_ADDRESS_TAKEN', 'EMAIL_COMMAND_CONFLICT'].includes(code))
      return 409;

    if (['PHONE_AUTH_DISABLED', 'SMS_PROVIDER_FAILED', 'ACCOUNT_DELETE_UNAVAILABLE'].includes(code))
      return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'SMS_PROVIDER_TIMEOUT') return HttpStatus.GATEWAY_TIMEOUT;
    if (code === 'SMS_PROVIDER_UNCERTAIN') return HttpStatus.BAD_GATEWAY;
    if (code === 'PHONE_RATE_LIMITED') return HttpStatus.TOO_MANY_REQUESTS;
    if (
      [
        'AUTH_ACCOUNT_UNAVAILABLE',
        'AUTH_VERIFICATION_GRANT_INVALID',
        'AUTH_STEP_UP_INVALID',
      ].includes(code)
    )
      return HttpStatus.UNAUTHORIZED;
    if (code === 'ACCOUNT_DELETE_ROLE_ACTIVE' || code === 'RESTRICTED_ACCOUNT_RECORD_DENIED')
      return HttpStatus.FORBIDDEN;
    if (
      [
        'AUTH_IDENTITY_ALREADY_BOUND',
        'AUTH_LOGIN_METHOD_ALREADY_BOUND',
        'ACCOUNT_DELETE_REQUEST_CONFLICT',
      ].includes(code)
    )
      return HttpStatus.CONFLICT;
    if (code === 'RESTRICTED_ACCOUNT_RECORD_NOT_FOUND') return HttpStatus.NOT_FOUND;
    if (['ASSISTANCE_UNAVAILABLE', 'ASSISTANCE_PROVIDER_UNAVAILABLE'].includes(code))
      return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'ASSISTANCE_PROVIDER_TIMEOUT') return HttpStatus.GATEWAY_TIMEOUT;
    if (code === 'ASSISTANCE_PROVIDER_RESPONSE_INVALID') return HttpStatus.BAD_GATEWAY;
    if (['ASSISTANCE_CONTEXT_UNAVAILABLE', 'ASSISTANCE_CONSENT_REQUIRED'].includes(code))
      return HttpStatus.FORBIDDEN;
    if (['ASSISTANCE_REQUEST_CONFLICT', 'ASSISTANCE_IN_PROGRESS'].includes(code))
      return HttpStatus.CONFLICT;
    if (code === 'ASSISTANCE_RESULT_EXPIRED') return HttpStatus.GONE;
    if (['ASSISTANCE_RATE_LIMITED', 'ASSISTANCE_QUOTA_EXCEEDED'].includes(code))
      return HttpStatus.TOO_MANY_REQUESTS;
    if (code === 'REALTIME_PROVIDER_UNAVAILABLE') return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'SOCIAL_PRESENCE_UNAVAILABLE') return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'REALTIME_WEBHOOK_INVALID') return HttpStatus.UNAUTHORIZED;
    if (code === 'ROOM_MEMBERSHIP_REQUIRED') return HttpStatus.FORBIDDEN;
    if (code === 'ROOM_SPEECH_CONSENT_REQUIRED') return HttpStatus.FORBIDDEN;
    if (code === 'ROOM_SPEECH_UNAVAILABLE') return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'POST_ROOM_KEYWORDS_CONSENT_REQUIRED') return HttpStatus.FORBIDDEN;
    if (code === 'POST_ROOM_KEYWORDS_UNAVAILABLE') return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'SOCIAL_ACCESS_RESTRICTED') return HttpStatus.FORBIDDEN;
    if (code === 'AUTH_PROVIDER_UNAVAILABLE') return HttpStatus.SERVICE_UNAVAILABLE;
    if (code === 'AUTH_PROVIDER_TIMEOUT') return HttpStatus.GATEWAY_TIMEOUT;
    if (code === 'ACCESS_TOKEN_INVALID' || code.startsWith('REFRESH_TOKEN_')) {
      return HttpStatus.UNAUTHORIZED;
    }
    if (code === 'PROFILE_REQUIRED' || code === 'AGE_RESTRICTED') {
      return HttpStatus.FORBIDDEN;
    }
    if (
      [
        'ROOM_ACCOUNT_RESTRICTED',
        'ROOM_HOST_REQUIRED',
        'ROOM_MEMBER_NOT_ACTIVE',
        'ROOM_INVITATION_REQUIRED',
      ].includes(code)
    )
      return HttpStatus.FORBIDDEN;
    if (['ROOM_HOST_RECONNECTING', 'ROOM_OPERATION_CONFLICT'].includes(code))
      return HttpStatus.CONFLICT;
    if (code === 'REPORT_CONTEXT_NOT_FOUND') return HttpStatus.NOT_FOUND;
    if (
      [
        'SOCIAL_TARGET_UNAVAILABLE',
        'SOCIAL_REQUEST_NOT_FOUND',
        'SOCIAL_RELATIONSHIP_NOT_FOUND',
        'ROOM_INVITATION_NOT_FOUND',
        'ROOM_INVITATION_TARGET_UNAVAILABLE',
      ].includes(code)
    )
      return HttpStatus.NOT_FOUND;
    if (code === 'HISTORY_CONTEXT_NOT_FOUND') return HttpStatus.NOT_FOUND;
    if (code === 'ROOM_NOT_ENDED' || code === 'NOTE_VERSION_CONFLICT') {
      return HttpStatus.CONFLICT;
    }
    if (code === 'REPORT_REQUEST_CONFLICT') return HttpStatus.CONFLICT;
    if (
      [
        'SOCIAL_REQUEST_STATE_CONFLICT',
        'SOCIAL_REQUEST_CONFLICT',
        'ROOM_INVITATION_REQUEST_CONFLICT',
      ].includes(code)
    )
      return HttpStatus.CONFLICT;
    if (code === 'ROOM_NOT_FOUND' || code === 'ROOM_SHARE_NOT_FOUND') return HttpStatus.NOT_FOUND;
    if (code === 'ROOM_SHARE_UNAVAILABLE') return HttpStatus.GONE;
    if (
      [
        'ROOM_EXTENSION_NOT_AVAILABLE',
        'ROOM_EXTENSION_LIMIT',
        'ROOM_EXTENSION_REQUEST_CONFLICT',
      ].includes(code)
    )
      return HttpStatus.CONFLICT;
    if (
      [
        'ROOM_NOT_STARTED',
        'ROOM_CANCELLED',
        'APPOINTMENT_ALREADY_STARTED',
        'APPOINTMENT_BOOKING_CLOSED',
        'RESERVATION_CONFLICT',
        'RESERVATION_ALREADY_USED',
        'RESERVATION_OWNER_REQUIRED',
        'ROOM_RESERVED',
      ].includes(code)
    )
      return HttpStatus.CONFLICT;
    if (code === 'ROOM_ENDED' || code === 'ROOM_FULL') return HttpStatus.CONFLICT;
    if (code === 'ROOM_PASSWORD_REQUIRED' || code === 'ROOM_PASSWORD_INVALID') {
      return HttpStatus.FORBIDDEN;
    }
    return HttpStatus.BAD_REQUEST;
  }

  private safePath(path: string): string {
    return path.startsWith('/v1/room-links/') ? '/v1/room-links/:shareCode' : path;
  }

  private retryAfterSeconds(exception: Error & { code: string }): number | undefined {
    if (
      ![
        'ASSISTANCE_RATE_LIMITED',
        'ASSISTANCE_QUOTA_EXCEEDED',
        'ASSISTANCE_IN_PROGRESS',
        'PHONE_RATE_LIMITED',
      ].includes(exception.code)
    )
      return undefined;
    if (!('details' in exception) || typeof exception.details !== 'object' || !exception.details)
      return exception.code === 'ASSISTANCE_QUOTA_EXCEEDED'
        ? 86_400
        : exception.code === 'PHONE_RATE_LIMITED'
          ? 60
          : undefined;
    const value = (exception.details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.ceil(value)
      : exception.code === 'ASSISTANCE_QUOTA_EXCEEDED'
        ? 86_400
        : undefined;
  }
}
