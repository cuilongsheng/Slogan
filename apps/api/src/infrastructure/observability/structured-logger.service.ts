import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

import { LOG_REDACTION } from './log-redaction.js';

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly logger: Logger = pino({
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: LOG_REDACTION,
  });

  log(message: unknown, context?: string): void {
    this.logger.info(
      this.fields(message, context),
      typeof message === 'string' ? message : undefined,
    );
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error(
      { ...this.fields(message, context), trace },
      typeof message === 'string' ? message : undefined,
    );
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn(
      this.fields(message, context),
      typeof message === 'string' ? message : undefined,
    );
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug(
      this.fields(message, context),
      typeof message === 'string' ? message : undefined,
    );
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace(
      this.fields(message, context),
      typeof message === 'string' ? message : undefined,
    );
  }

  private fields(message: unknown, context?: string): Record<string, unknown> {
    return typeof message === 'object' && message !== null ? { ...message, context } : { context };
  }
}
